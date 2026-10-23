"""Historical PH-007 low-level diagnostic; never uses the personal library.

This intentionally bypasses the DestinationGuard introduced by Lot 0 and can
still demonstrate unsafe copying when callers omit native preview admission.
It does not test the corrected job. Use its permanent sibling Rust regression
for failing-before/passing-after validation.

Requires the current locked phemios-transfer rlib, Rust compiler and existing
Apple Silicon embedded Aede executable. This diagnostic does not prepare/update
the engine, resolve dependencies or exercise the UI/authenticated export route.
It extracts the unchanged private copy helper and links the real Mounted policy.
All writes by the probe occur in its private OS temporary directory.
"""
from pathlib import Path
import datetime, hashlib, json, subprocess

# Run only in a trusted checkout with the current locked transfer library built.
root=Path(__file__).resolve().parents[3]
out=root/'target/quality/PH-STAB-001/PH-007'
out.mkdir(exist_ok=True)
job=(root/'src-tauri/src/transfer_job.rs').read_text()
copy=job[job.index('fn copy(\n'):job.index('\nfn output_files(')]
source='''use serde_json::{Value,json};
use std::{fs,path::Path};
use phemios_transfer::Mounted;
'''+copy+'''
fn main() {
 let base=std::env::temp_dir().join(format!("phemios-ph007-{}",std::process::id()));
 fs::create_dir(&base).unwrap();
 let engine=std::env::args_os().nth(1).unwrap();
 let fixture=std::env::args_os().nth(2).unwrap();
 let source_bytes=fs::read(fixture).unwrap();
 let mut victim_bytes=source_bytes.clone();
 *victim_bytes.last_mut().unwrap()^=0x55;
 for replace in [false,true] {
  let case=base.join(if replace {"replace"}else{"preserve"});
  fs::create_dir(&case).unwrap();
  let dest=case.join("destination"); fs::create_dir(&dest).unwrap();
  let watched=dest.join("Example Artist");
  let mount=Mounted::capture_folder(dest.clone()).unwrap();
  let roots=vec![watched.to_string_lossy().into_owned()];
  assert!(!watched.exists());
  let initial=mount.outside(&roots);
  assert!(initial.is_ok());
  // A previously unavailable watched directory becomes visible after preview.
  let victim=watched.join("Example Album/01.wav");
  fs::create_dir_all(victim.parent().unwrap()).unwrap();
  fs::write(&victim,&victim_bytes).unwrap();
  let origin=watched.join("Example Artist/Example Album/01.wav");
  fs::create_dir_all(origin.parent().unwrap()).unwrap();
  fs::write(&origin,&source_bytes).unwrap();
  assert!(mount.outside(&roots).is_err());
  // This is exactly the staging tree and copy helper used by the native job.
  let staged=case.join("music");
  let selected=staged.join("Example Artist/Example Album/01.wav");
  fs::create_dir_all(selected.parent().unwrap()).unwrap();
  fs::write(&selected,&source_bytes).unwrap();
  let data=case.join("catalog");
  let result=copy(Path::new(&engine),&staged,&data,mount.path(),
    &json!({"format":"original","verify":true,"replace":replace}),
    &||mount.confirm(),&|_,_|{});
  let after=fs::read(&victim).unwrap();
  if replace { assert!(result.is_ok(),"{result:?}"); assert_eq!(after,source_bytes); }
  else { assert!(result.is_err(),"{result:?}"); assert_eq!(after,victim_bytes); }
  assert_eq!(fs::read(&selected).unwrap(),source_bytes);
  assert_eq!(fs::read(&origin).unwrap(),source_bytes);
  println!("{}",json!({"replace":replace,"unavailable_root_admitted":initial.is_ok(),"same_destination_identity":mount.confirm().is_ok(),"overlap_refused_if_rechecked":mount.outside(&roots).is_err(),"copy_ok":result.is_ok(),"copy_error":result.err(),"watched_audio_changed":after!=victim_bytes,"staged_source_unchanged":true}));
 }
 fs::remove_dir_all(base).unwrap();
}
'''
(out/'probe.rs').write_text(source)
deps=root/'target/debug/deps'
def rlib(name):
 paths=list(deps.glob('lib'+name+'-*.rlib'))
 if not paths:raise RuntimeError('Missing prebuilt '+name)
 return max(paths,key=lambda p:p.stat().st_mtime)
cmd=['rustc','--edition=2024',str(out/'probe.rs'),'-L','dependency='+str(deps),'--extern','serde_json='+str(rlib('serde_json')),'--extern','phemios_transfer='+str(rlib('phemios_transfer')),'-o',str(out/'probe')]
subprocess.run(cmd,check=True)
engine=root/'src-tauri/binaries/phemios-aede-aarch64-apple-darwin'
fixture=root/'crates/phemios-cd/tests/fixtures/ramp.wav'
version=subprocess.run([str(engine),'--version','--json'],capture_output=True,text=True,check=True).stdout
run=[str(out/'probe'),str(engine),str(fixture)]
result=subprocess.run(run,capture_output=True,text=True,timeout=120)
log=(result.stdout+result.stderr).replace(str(root),'<repository>')
# Probe-created temporary paths do not contain user data, but keep durable evidence generic.
import re
log=re.sub(r'/var/folders/[^ "\\]+/T/phemios-ph007-\d+','<temporary-fixture>',log)
(out/'probe.log').write_text(log)
metadata=dict(date=datetime.datetime.now(datetime.timezone.utc).isoformat(),candidate=subprocess.check_output(['git','rev-parse','HEAD'],cwd=root,text=True).strip(),compile=cmd,run=run,exit=result.returncode,engine_version=json.loads(version),engine_sha256=hashlib.sha256(engine.read_bytes()).hexdigest(),copy_helper_sha256=hashlib.sha256(copy.encode()).hexdigest(),probe_sha256=hashlib.sha256(source.encode()).hexdigest(),log_sha256=hashlib.sha256(log.encode()).hexdigest())
(out/'evidence.json').write_text(json.dumps(metadata,indent=2)+'\n')
print(log)
print(json.dumps({k:v for k,v in metadata.items() if k not in ['compile','run']},indent=2))
if result.returncode:raise SystemExit(result.returncode)

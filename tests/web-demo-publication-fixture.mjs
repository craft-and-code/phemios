import { mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
/** Tiny inert files exercise publication admission; they are never presented as playable music. */
export async function installWebDemoFixture(root) {
  const write = async (file, bytes) => {
    await mkdir(path.dirname(path.join(root, file)), { recursive: true });
    await writeFile(path.join(root, file), bytes);
  };
  const revision = "a".repeat(40);
  await write(
    "web-build.json",
    JSON.stringify({ profile: "public-demo", base: "./", sharedAudio: revision }),
  );
  await write("index.html", '<script type="module" src="./assets/demo.js"></script>');
  for (const file of [
    "assets/demo.js",
    "web-audio/processor.js",
    "web-audio/wasm/phemios_web_audio.js",
    "web-demo/ATTRIBUTION.txt",
  ])
    await write(file, "inert fixture");
  await write("web-audio/wasm/provenance.json", JSON.stringify({ sharedAudio: revision }));
  await write(
    "web-audio/wasm/phemios_web_audio_bg.wasm",
    Buffer.from([0, 97, 115, 109, 1, 0, 0, 0]),
  );
  const credits = [];
  for (let i = 0; i < 10; i++) {
    const bytes = Buffer.from(`test recording ${i}`),
      file = `audio/fixture${i}.mp3`;
    await write(`web-demo/${file}`, bytes);
    await write(`web-demo/fixture${i}.svg`, "fixture");
    credits.push({
      file,
      artist: "Test artist",
      licence: "CC BY 4.0",
      licence_url: "https://creativecommons.org/licenses/by/4.0/",
      modified: false,
      sha256: createHash("sha256").update(bytes).digest("hex"),
    });
  }
  await write("web-demo/credits.json", JSON.stringify(credits));
}

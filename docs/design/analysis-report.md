# Reusable analysis report

`src/analysis-report/` is the native-independent presentation of retained FlacCompagnon measurements. `AnalysisCharts` supplies Phémios locale/translation; imported documents use the same `AnalysisReport` through `AnalysisDocument`. There is no network, native IPC, catalogue, account or audio-file dependency in the reusable module. It uses the existing pure icon vocabulary.

## Evidence and remembered disclosures

The report has one presentation rather than compact/detailed modes. A single animated chevron points right when all rubrics are closed and down when at least one is open. Its action expands all or collapses all while preserving independent integrity, detection, identity, additional measurement, technical, missing-coverage and fingerprint disclosures. The three headline level descriptors and applicable listening observations remain visible. Disclosures use inline SVG chevrons centered with their labels. Warning icons accompany positive detections, extension disagreement, bit-depth differences, dual mono, suspected polarity inversion, inter-sample overs and flagged clipping/clicks. These are observations to interpret, not a quality score.

The App stores exact open-section identities as `analysisSections` within `phemios.tools.v1`, using its existing owner-isolated preference projection, synchronization and backups. Older stored options default to an empty section list; unknown and duplicate identities are rejected without overwriting the original bytes. Writes precede UI acknowledgement. Direct summary activation saves synchronously; native toggle events remain guarded against programmatic changes and rejected writes. The reusable component receives optional controlled `sections` and `onSectionsChange` props; it imports no preference store. Standalone `sections` initialize the state, while `onSectionsChange` lets the host persist each explicit choice. The legacy `detailed` option only initializes all disclosures as open.

The multi-file list has a noninteractive shield header aligned with the fixed-width integrity column. It turns green when every reported integrity verdict is good. An imported MD5 Match keeps its green check because it is a completed report result; the retained text and tooltip still explicitly state that Phémios has not reverified the current file. Missing/unperformed digests and explicitly stale evidence do not become green. Full measurement rails are keyboard/touch targets for their vertical markers: hover/focus explains a measurement, click/tap pins it, and a second activation, outside touch, blur or Escape dismisses it. Pointer-only hover is suppressed on touch devices. Hints include the exact value/unit and interpretation, retain visible values without interaction, and remove their document listener on dismissal/disposal. They do not change playback or infer unmeasured data. Losing focus explicitly dismisses an older hint even if mouse hover was retained; the next keyboard-focused rail may show its own hint.

Event timelines retain the source positions and channels. Their SVG uses the complete axis width, with bounded endpoints and an aligned, readable minute/second caption; a single-file report caps the timeline width instead of spreading the endpoints across an excessively wide page. Hover, keyboard focus or click/touch on a retained event reveals its start, duration and channel in a reserved readout below the axis. A second activation or Escape clears it. Switching the report clears earlier selection. This is an inspection of retained evidence, not seeking or replaying audio.

Embedded FLAC audio MD5 is separate from whole-file MD5/CRC32 and Ogg page CRC. No Ogg page verdict is inferred from file hashes. NoSignature, Present, Match, Mismatch and Error stay distinct. A successful imported comparison describes the report's analyzed bytes; the current audio file remains unverified. Aède's explicit stale=false can confirm a retained result's freshness; stale and unknown remain distinct from the reported comparison outcome. Reading imported JSON invokes neither FlacCompagnon nor audio decoding and requires no account. Provider diagnostics and filenames are rendered as text. Explicit analyses_run coverage suppresses unrequested placeholder zeros/false flags. Unknown values are not invented.

## Read-only import

Analysis → Import an analysis remains available without a connected account. The native dialog selects exactly one local JSON file; its path never comes from WebView input. The dedicated command reads only regular non-symlink UTF-8 files, with a metadata check and a second capped read at 16 MiB. Browser previews use a local File input with the same byte limit. Neither route follows audio paths, fetches services, writes reports nor imports conclusions into Aède.

The validator accepts the published flaccompagnon-report version-1 envelope, legacy FolderReport and individual FileAnalysis objects. It refuses empty documents, unknown versions, malformed known evidence and more than 2,000 entries. Unknown optional fields may coexist. Selected album files retain their source order; only one report is expanded/rendered at a time. Failed/cancelled imports preserve the previous document; disposal excludes late replies. Returning to catalogue coverage resumes its existing authenticated read.

## Website distribution

`npm run analysis:build` produces `dist-analysis/flac-analysis-report.js` and `flac-analysis-report.css`. The ES2022 ESM bundle includes Solid, with no framework prerequisite, additional dependency or CDN. It does not import Phémios's main entry, account context, desktop bridge or complete translation catalogue. Import the stylesheet once; mount only into an empty host-owned element:

```js
import { mountAnalysisReport } from "./flac-analysis-report.js";
const view = mountAnalysisReport(document.querySelector("#report"), {
  document: reportJsonText,
  locale: "fr",
});
// Validate before replacing the current report.
view.update({ document: anotherReportJsonText, locale: "fr" });
view.dispose();
```

React, Solid or a plain website may instead integrate the props-only source components. Hosts can supply `translate(message, ...parameters)` and a supported Intl locale; the default labels are French. The optional `sections` mount setting selects initially open rubrics; `onSectionsChange` reports subsequent explicit changes. Update does not override an intervening user disclosure choice. Host theme variables use the `--analysis-*` tokens documented at the top of report.css; default inherited tokens match Phémios.

The FlacCompagnon website is not modified or published by this task. Its integration can consume these two generated files without copying the presentation implementation.

## Verification

Unit cases cover real-envelope/single-file admission, cumulative detections, historical/current MD5, Ogg separation, malformed numbers/flags/coverage/digests, size/count limits and unrequested default suppression. The sibling native test checks exact unchanged file contents, directory/symlink/UTF-8/size refusal. Data/AnalysisReport stories exercise expand/collapse, remembered disclosures, mouse/touch-style marker hints, arrow geometry, source explanation, album selection, literal unsafe-looking text and the actual import surface. These fictional fixtures do not assert physical decoding or acoustic acceptance.

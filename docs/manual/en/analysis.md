# Understand your files

Phémios presents several complementary kinds of evidence. An intact file is not necessarily a good recording; an audio measurement is not proof of authenticity.

## Test an album now

In an Album page, the integrity icon to the right of Tracks starts a transient check. A check means success, a cross means error and a dash means no applicable hash. Track titles remain aligned. Click a red cross for details without downloading a report.

This transient result does not replace saved analyses. Applicable checks depend on format, signatures and available tools. [Aède explains integrity checks](https://craft-and-code.github.io/aede/docs/en/cli/check.html).

## Read analyses

Analysis shows coverage to avoid unnecessary repeated work. Sort its columns and open an album or track to inspect available results. Track icons open the corresponding measurements, spectra and lyrics.

For dynamics, levels, peaks, frequencies and interpretation limits, use [FlacCompagnon documentation](https://craft-and-code.github.io/FlacCompagnon/). Phémios does not turn these measures into an absolute quality verdict.

## Generate or export

Administrators can start analyses and spectra supported by their engine. Actions show activity and offer their supported cancellation. Choose Recalculate existing results before starting. Completed actions remain disabled when recalculation is not requested.

Settings → Aède offers whole-library generation, individually or in sequence. Existing JSON results and spectrum images can be downloaded. Processing, storage, formats and commands are documented by [Aède](https://craft-and-code.github.io/aede/docs/en/index.html), rather than duplicated in this interface manual.

## Import a FlacCompagnon result

In **Analyses**, choose **Import an analysis** next to Refresh and select an album or single-track JSON. It works without Aède and does not modify your library or server conclusions. Album entries retain their order; choose a track to see its result. Return restores catalogue coverage.

A single animated chevron expands or collapses all additional information: right when every section is closed, down when any section is open. Individual open sections are remembered in account preferences and backups. Hover/focus a green marker for its value and explanation, or click/tap its rail to pin it; repeat the action, click outside or press Escape to dismiss. Click/dropout markers also reveal their start, duration and channel on hover or click/tap. The file list has a shield heading for integrity results, green only when all integrity verdicts are good. Expand individual chevrons for explanations, missing measurements and file hashes. The shield identifies audio MD5; warning triangles identify observations to interpret. Clean does not establish source provenance, and a matching MD5 does not rate mastering quality. An imported verdict describes the report, not a fresh verification of the current audio file. Whole-file hashes do not replace Ogg page checks. Imports accept supported reports up to 16 MiB and 2,000 tracks.

Imported JSON can be read without an account or server. Its check marks describe FlacCompagnon's stored result; Phémios neither reruns analysis nor verifies the current audio files. A dash indicates no usable verdict, for example an absent or unverified reference signature.

On an Album page, the shield starts a fresh integrity test through Aède. Engines supporting progressive results expose each completed track while the check continues. Stopping retains already completed results in the mounted page; leaving it clears them. Update and restart Aède to enable the new capability.

# Listen and build a session

The footer stays available while browsing. Its cover opens the album, its title opens the track and its artist name opens the artist. It can start the queue built in Playlists or a compatible visible selection.

The current DSP mode requests album loudness normalization; bass and treble stay neutral. It does not deliberately color the sound. With no usable normalization gain/measurement, or only a small correction, it may sound indistinguishable from Without DSP. Changing mode preserves the current track and already preloaded tracks: the selected mode applies to subsequent source preparation without restarting playback. Crossfade is used only in DSP mode with a duration above zero.

## Essential controls

Play/pause, previous, next and Stop control the active source. Space starts or pauses audio outside editing fields and dialogs. Click the speaker to mute or unmute; volume remains adjustable before playback and its level is retained.

Click the waveform to seek. A pointer line marks the target. Click duration to switch between total and remaining time. Live radio has no recorded-track seeking.

## Output and processing

Audio settings selects a recognized output device. Without DSP and DSP are distinct policies; bit-perfect availability depends on transport and hardware. Selecting a label cannot make a remote PCM stream bit-perfect.

Crossfade is configured in DSP mode. Mixing two tracks necessarily transforms their signal. Engine processing and output limitations belong to [Aède](https://craft-and-code.github.io/aede/docs/en/dsp/start.html). HQPlayer needs a separate installation and access to the files; Phémios does not include HQPlayer.

## Retrieve lyrics

Recognized lyrics already in metadata or companion files are displayed when available. Otherwise, request retrieval explicitly; this does not start playback.

- **One track**: use its lyrics icon with an arrow. Its tooltip identifies LRCLIB and states that no API key is required. This action requires an administrator account for that source.
- **An album or queue**: use the batch lyrics action near the Tracks controls or in the queue drawer. Track indicators update as work progresses; the batch action becomes unavailable when everything is already present.
- **The whole library**: open **Settings → Aède**, select the source when needed and choose **Lyrics**. You can also select **Lyrics** during [enrichment](artists.md#retrieve-images-and-biographies).

LRCLIB needs no API key. Track metadata is used for matching; no match does not mean your audio file is faulty. Aède retains acquired words, including companion `.lrc` files, without rewriting track tags. Results can be timed or untimed; only timed lyrics follow playback automatically. Retrieval and retention rules belong to the [Aède manual](https://craft-and-code.github.io/aede/docs/en/index.html).

## Lyrics and Playback view

The Playback icon opens visuals; starting a track does not automatically change your page. Choose an effect and click it again to disable it. The frequency control cycles bar styles and hiding. Ordinary lyrics can be shown or hidden; floating lyrics have their own presentation.

Synchronized lyrics follow supplied timestamps. Untimed text uses manual navigation arrows. Queue icons indicate availability and allow explicit retrieval. Batch retrieval continues after closing the drawer; Stop cancels subsequent submissions.

## Network players

In **Output and playback mode → Network players**, use the shared selector: OpenHome, Cast, SlimProto, then UPnP. An administrator account and an updated Aède engine are required. Enter the private IPv4 address of the machine running Aède when the connection cannot supply it, then discover players. Prepare 1–64 tracks from the same library and choose **Play on network player**. The embedded or remote Aède engine sends original files directly.

For **Cast**, inspect the certificate, verify its fingerprint on your trusted network, then explicitly confirm it. Trust is not saved permanently. **OpenHome and Cast** require explicit permission before replacing existing playback or a playlist.

For **SlimProto**, open **Add a SlimProto player**, enter the player's IPv4 address and add it to the same selector. After starting, connect Squeezelite to the indicated server, for example `squeezelite -s AEDE_ADDRESS:3483`. The connection window is one minute; a player attached to another server requires deliberate reconfiguration. Its volume is preserved and may initially be muted.

**Stop network player** requests shutdown and reports missing confirmation. These profiles are experimental: footer controls remain local and do not control the remote player's volume, crossfade or DSP. File transfers never imply listening history. Losing the session or heartbeat requests shutdown but cannot guarantee the device discarded buffered audio. [Profile details in Aède](https://craft-and-code.github.io/aede/).

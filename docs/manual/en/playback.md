# Listen and build a session

The footer stays available while browsing. Its cover opens the album, its title opens the track and its artist name opens the artist. It can start the queue built in Playlists or a compatible visible selection.

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

## UPnP network player

In **Output and playback mode**, **UPnP** provides an initial integration for an administrator account and an updated Aède engine. A private IPv4 host already used by the connection is reused automatically; the pencil lets you override it. Otherwise enter the LAN IPv4 address of the machine **running Aède**, then discover devices. `localhost` and a proxy address do not necessarily identify that network interface. Select a player and prepare a queue of 1–64 tracks from one library. **Listen on the UPnP player** stops local playback and asks Aède to send original files directly to the renderer. **Stop UPnP** requests shutdown; an unconfirmed stop is reported.

These controls are dedicated to UPnP: the bottom local transport, local volume, DSP and crossfade do not yet control the network player. Losing the session or control heartbeat requests shutdown after a safety interval; the device may retain buffered audio. [Server details and profile limits in Aède](https://craft-and-code.github.io/aede/).

AirPlay is not connected in this version.

# Your libraries

One catalogue brings local and server sources together. When both are present, origin badges distinguish their editions. A single source needs less visual labelling.

## Add local folders

“Importing” music adds it to the catalogue: Phémios neither moves nor duplicates your tracks.

1. Open the gear, then **Libraries**.
2. Under **Local library**, click **Enable local Aède**.
3. Click **Add folders…** and select the folder containing your artists and albums. You can add several folders.
4. Click **Scan folders**: adding a path alone does not start a scan. This discovers files; it is not a FlacCompagnon audio analysis.
5. Wait for the task result, then use **Sync local catalog** to reread the catalogue if needed.
6. Open **Albums** or **Artists** to browse your music.

After adding tracks on disk, scan again. Synchronization alone does not walk the folders. Removing a configured root never deletes its files. Root and exclusion rules are explained in the [Aède manual](https://craft-and-code.github.io/aede/docs/en/index.html).

Scanning does not provide every image or lyric: continue with [retrieving images and biographies](artists.md#retrieve-images-and-biographies) and [retrieving lyrics](playback.md#retrieve-lyrics).

Your operating system must mount network folders. Check availability before scanning; Phémios does not mount shares for you. An unavailable source can retain cached catalogue entries without being playable.

## Connect a server

Enter its address and sign in under Aède server. The connection dot shows its state. For the Aède server App, use its exported connection profile. The [Aède App guide](https://craft-and-code.github.io/aede/docs/en/server/reference/desktop.html) explains startup and local certificate trust.

Preference backups exclude passwords and service keys. Account permissions determine which actions are available.

## Scan or synchronize?

- **Scan** inspects the engine’s folders and discovers added or moved files. Apply folders and scan also applies your root changes.
- **Synchronize library** reads Aède’s existing catalogue into Phémios’s navigation cache. It does not discover a new album on disk by itself.
- **Refresh folders** reads their configuration; it is not a scan.

After adding files, scan the correct source, wait for the task result, then synchronize. Offline browsing uses available cached information; it does not make remote audio accessible without its server.

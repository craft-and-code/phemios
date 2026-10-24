# Your libraries

One catalogue brings local and server sources together. When both are present, origin badges distinguish their editions. A single source needs less visual labelling.

## Add local folders

“Importing” music adds it to the catalogue: Phémios neither moves nor duplicates your tracks.

1. Open the gear, then **Libraries**.
2. Under **Local library**, click **Start local Aède**.
3. Click **Add folders…** and select the folder containing your artists and albums. You can add several folders.
4. Click **Scan folders**: adding a path alone does not start a scan. This discovers files; it is not a FlacCompagnon audio analysis.
5. Wait for the task result, then use **Reload local catalogue** to reread the catalogue if needed.
6. Open **Albums** or **Artists** to browse your music.

After adding tracks on disk, scan again. Synchronization alone does not walk the folders. Removing a configured root never deletes its files. Root and exclusion rules are explained in the [Aède manual](https://craft-and-code.github.io/aede/docs/en/index.html).

Scanning does not provide every image or lyric: continue with [retrieving images and biographies](artists.md#retrieve-images-and-biographies) and [retrieving lyrics](playback.md#retrieve-lyrics).

Your operating system must mount network folders. Check availability before scanning; Phémios does not mount shares for you. An unavailable source can retain cached catalogue entries without being playable.

## Connect a server

Enter its address and sign in under Aède server. The connection dot shows its state. For the Aède server App, use its exported connection profile. The [Aède App guide](https://craft-and-code.github.io/aede/docs/en/server/reference/desktop.html) explains startup and local certificate trust.

In the Aède App, starting the server or changing folders while it runs starts a background scan. Wait for its result: Phémios then detects the new catalogue automatically without changing views. With the CLI, use folder-management and scan commands against the connected server’s data directory. A command with `--no-scan` intentionally leaves content pending until the next scan.

For administrators, **Folders supplied by Aède** displays server roots read-only. Edit folders in the Aède App or CLI: Phémios keeps no second editable list. **Scan the server folders** requests another scan of Aède’s known roots. The refresh button only rereads their list.

Preference backups exclude passwords and service keys. Account permissions determine which actions are available.

## Scan or synchronize?

- **Scan** inspects the engine’s folders and discovers added or moved files. Remote folders remain configured in Aède.
- **Synchronize library** reads Aède’s existing catalogue into Phémios’s navigation cache. It does not discover a new album on disk by itself.
- **Refresh folders** reads their configuration; it is not a scan.

After adding files, scan the correct source and wait for the task result. Phémios checks the catalogues of connected sessions every five seconds and reloads them when they change. Manual reload remains available when needed. Offline browsing uses available cached information; it does not make remote audio accessible without its server.

## Hide or clear the server catalogue

After disconnection, the server catalogue remains available offline. Under **Settings → Libraries → Aède server**, **Hide server catalogue** removes it from browsing without deleting its cache; **Show server catalogue** reverses this choice. Visibility is retained on this device. An active connection always displays its catalogue.

**Clear server cache…** asks for confirmation, then removes only the cached server catalogue and images on this device. The local library, music files, accounts, favourites and other personal data are preserved. Reconnect and reload the catalogue to retrieve it again. Disconnect the server before either action. Older Apps require an update to provide the clearing command.

## Manage local exclusions

Under **Local library → Folders excluded from scanning**, the list is read-only. **+** selects folders to exclude. Select a row and use **−** to remove that exclusion. The **−** control in the main folders list instead removes a watched library root. Neither operation deletes audio files.

Aède does not traverse excluded folders or their subfolders during subsequent scans requested by Phémios. Run **Scan folders** after changing rules: previously catalogued excluded tracks disappear only after that scan. Removing an exclusion allows them to return during the next scan.

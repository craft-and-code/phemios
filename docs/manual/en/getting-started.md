# Getting started

Phémios is the desktop application for browsing and listening to your music collection. Its bundled Aède engine builds the catalogue. You can also connect an Aède server, or use both libraries together.

## Install a published release

Download the installer for your system from the [Phémios GitHub releases](https://github.com/craft-and-code/phemios/releases). Names follow the `phemios-App-VERSION-PLATFORM` pattern: `.dmg` for Apple Silicon macOS, `.msi` or `.exe` for Windows x64, and `.AppImage`, `.deb` or `.rpm` for x86_64 Linux. When a `.sha256` file is published, verify it before opening the installer. The local Aède engine is bundled with the app; a remote Aède server remains optional.

On macOS, open the `.dmg`, drag **Phémios** to **Applications**, then launch it. If macOS blocks a downloaded app because it still has the quarantine attribute, close Phémios and run this command in **Terminal**:

```
xattr -dr com.apple.quarantine "/Applications/Phémios.app"
```

Adjust the path if you installed the app elsewhere, then open it again. This command removes only Phémios' quarantine attribute; it does not disable Gatekeeper for other applications.

On Windows, run the `.msi` or `.exe` and approve the SmartScreen prompt if Windows asks you to confirm it. On Linux, make the AppImage executable (`chmod +x Phémios.AppImage`, then `./Phémios.AppImage`) or install the `.deb`/`.rpm` package with your distribution's package manager.

The [component catalogue](../../components/index.html) also lets you explore the interface with fictional data, without installing the app, signing in or using a personal library; it does not play real audio files.

## Run from source

To run the sources, install Node.js 22.12+ within major 22, Node.js 24 or 26+, Rust 1.90+ and the [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/). From the project folder, run:

```
npm ci
npm run tauri dev
```

Preparation automatically selects the latest published stable [Aède](https://craft-and-code.github.io/aede/) release, fetches its locked dependencies and builds the bundled engine from that exact source. It requires network access during preparation; compilation then runs locked/offline. No sibling checkout or separate Aède installation is required.

## Your first library

1. Open the gear, then Libraries.
2. Enable the local engine and choose a music folder.
3. Start a scan explicitly and wait for its result.
4. Open Albums, choose a record and start playback.

Start with a small folder while learning the interface. Scanning changes neither audio files nor their tags. [Library management](libraries.md) explains scanning versus synchronization.

## Complete your collection

Once records are visible, continue with [folder management](libraries.md), [retrieving covers, banners and biographies](artists.md#retrieve-images-and-biographies), then [retrieving lyrics](playback.md#retrieve-lyrics). File scanning and online enrichment are separate actions.

## Find your way around

The left navigation chooses the view. Search is at the top. Playback controls stay at the bottom while you change pages. The gear opens language, appearance, navigation and playback settings. An account is not required for audio CDs or permitted guest radio listening.

## Use a collection as a menu

Available collections can be rearranged with their grips or Alt+Up/Down before adding them. This preparation order lasts for the current Navigation visit and account; a selected group is added in its displayed order. One green line marks the insertion position, both inside this list and when copying a collection into the menus.

Create and save your selection from catalogue filters or the **Collections** page. In **Settings → Navigation**, select one or more collections in the right list: **Shift-click** or **Shift+arrows/Home/End** selects a range, Ctrl/⌘-click selects separate rows and Ctrl+A/⌘A selects all. Ctrl/⌘+Shift adds a range to the current selection. Click **Add to menu** (or **Add N collections to menu**), or press Enter. The whole group is saved once: refusal preserves the existing menus. Double-click adds one collection; you can also drag a collection onto the desired menu row. The collection list moves below menu organization on small screens. Each shortcut opens its albums directly, using the saved rule evaluated by Aède. Search at the top narrows that collection.

Move the new row with its grip or arrow buttons, rename it with the pencil, or hide it with the checkbox. The trash icon removes only the menu shortcut; your collection stays saved. Shortcuts belong to the active account and library. The collection and its menus share one name: renaming either updates the other, including multiple shortcuts. The list reloads when you return to Navigation; there is no separate Refresh button. Deleting a collection leaves its old shortcuts unavailable, even if another collection later reuses its name. A compatible Aède engine is required; an older engine shows an update/restart message. Resetting the menu removes its shortcuts.

In **Settings → Libraries → Excluded folders**, Up/Down selects a row. **Shift-click** or **Shift+arrows/Home/End** extends or shrinks a range from its original anchor; Ctrl/⌘+Shift adds that range to the current selection. While this list has focus, **Ctrl+A** (**⌘A on Mac**) selects all; Ctrl/⌘-click toggles individual rows. Delete/Backspace or **−** removes the selected exclusion rules without deleting audio files. A plain click or unmodified arrow returns to single selection. A neighboring row remains selected after removal for chained operations. A failed removal stops the batch: successful removals remain applied, while the remaining exclusions stay selected with a visible error. Drag rows or use Alt+Up/Down to organize one row at a time; this order is remembered locally and does not affect scanning.

The shared **album catalog** has the same header and presentation controls as Albums: reverse order, recent additions, cover size, List, Grid and Cover Flow. The Grid button sits between List and Cover Flow. Cover sizing is available in album List and Grid modes; it stays disabled in Cover Flow. On narrow list rows, artwork width is limited to leave room for titles and playback buttons. Compilations also supports Cover Flow and retains Grid by default. Each view remembers its presentation during the session. Search and filter resets stay within the saved collection; each menu keeps its own filters for the current account/library. Creating a derived collection from this view is unavailable; edit the saved rule in Collections instead.

Use **Add spacing**, then its pencil, to create an optional group title. A named spacer appears like LIBRARY, without an icon and with the same left inset. Clear its name to restore blank space. It can still be moved, hidden or removed.

## Aède diagnostics

When an internal Aède error appears, click **View diagnostics** in the message. The dialog lists failed operations and their library. The journal keeps the latest 64 errors for current connections and clears them on logout. It contains neither request parameters nor the internal server log.

If personal data becomes unreadable after an update, check compatibility with the Aède engine in use. An older engine may display the public catalogue while refusing newer notes, preferences or collections. Use a compatible engine; do not delete personal data or rescan to attempt a downgrade.

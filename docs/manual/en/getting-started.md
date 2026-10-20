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

Preparation needs the sibling Aède repository or an explicitly configured compatible engine. Engine build instructions belong to [Aède](https://craft-and-code.github.io/aede/). Fetch Cargo dependencies before the offline preparation step.

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

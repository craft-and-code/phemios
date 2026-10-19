# Getting started

Phémios is the desktop application for browsing and listening to your music collection. Its bundled Aède engine builds the catalogue. You can also connect an Aède server, or use both libraries together.

## Try the project

Phémios is in development. This site does not offer a public installer yet. Explore the controls without an installation, account or personal library in [Storybook](../../components/index.html). These are fictional scenarios without real audio playback.

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

# Questions and troubleshooting

## An album is missing after synchronization

Synchronization reads the existing catalogue. Check the source and mounted folder, run a scan, wait for its result, then synchronize. The Aède server App and Phémios can use separate data profiles: verify the actual address. Show all also checks whether a filter is hiding an album.

## Artwork is visible but playback is unavailable

The image may be cached while its server or folder is unavailable. Check connection, edition origin and source file availability. A missing-album discography suggestion is not a present file.

## Artwork or a biography is missing

Check service keys and request the appropriate enrichment in External sources. External identity or provider links may be absent. Retrying a missing image is different from scanning or updating the application.

## A radio station will not start

A station listing does not guarantee a live compatible stream. Try another station and check the HTTPS filter. Radio search and listening do not need an Aède server; favourites belong to an account. Errors distinguish expired searches from interrupted streams.

## Lyrics do not follow the music

Only timestamped lyrics can synchronize. Use arrows for untimed text. Request retrieval explicitly when offered, then check any reported error. LRCLIB retrieval needs no API key. Phémios does not invent synchronization timestamps.

## Where can I learn more?

Diagnostic exposes library checks provided by the engine. Statistics describes your catalogue and can export CSV. Encyclopedia offers reference entries and Wikipedia searches; saved articles are private per account. Earned trophies remain unlocked.

For commands, accounts, formats or server errors, read [Aède](https://craft-and-code.github.io/aede/docs/en/index.html). For audio measures, read [FlacCompagnon](https://craft-and-code.github.io/FlacCompagnon/). Explore controls without changing your library in [Storybook](../../components/index.html). [Rustdoc](../../rust/phemios_core/index.html) and [TypeScript contracts](../../typescript/index.html) are for developers.

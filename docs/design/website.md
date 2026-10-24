# Website and user manual

The bilingual static website preserves the shared dark/lime identity and existing vector brand assets. Its product narrative proceeds from finding an album to exploring collaboration credits, artist imagery/biographies and the listening experience. Personal organization and the three-tool ecosystem follow. It explains benefits through actual UI captures with fictional content, without fabricated adoption figures, testimonials, performance benchmarks or release promises.

The primary discovery action leads to product content; first-run guidance and the browser-only component explorer provide honest next steps while no public installer exists. The homepage explicitly states the development status. Screenshots do not constitute physical audio/device acceptance.

## Documentation boundary

Eleven paired Markdown chapters form a user manual: first run, libraries, browsing, artist stories, personal music, playback, other audio sources, analyses, settings, external players and troubleshooting. Aède remains the authority for engine commands, account rules and server operations. FlacCompagnon remains the authority for detailed analysis interpretation. Rustdoc, TypeScript declarations and the isolated Storybook are separate developer resources rather than substitutes for user instructions.

Manual navigation includes chapter filtering, a section table of contents, paired language links preserving the chapter, previous/next links and a compact-screen disclosure. The text measure stays near 80 characters. Filtering and navigation need no account, network service or persistent browser state. Static rendering escapes literal HTML and refuses executable link protocols.

## Build and publication

See [website maintenance](../../site/README.md). `npm run site:build` assembles the two homepages, both manual editions and the existing generated technical outputs in `dist-site/`, checking relative links and fragments. It does not rebuild the native App. A missing technical entry point fails assembly instead of shipping an empty link. All paths must work below a deployment prefix, not only at a domain root. Native App installation/build and website publication remain separate operations.

The project Pages destination is <https://craft-and-code.github.io/phemios/>. The separate [Pages workflow](../../.github/workflows/pages.yml) builds the complete site on Ubuntu 22.04 with Node.js 24 and stable Rust, preparing the latest published stable Aède engine/version metadata needed by native Rustdoc. It checks the website/manual and fresh technical outputs before uploading only `dist-site/`. Publication runs only for `main`, after a successful build, using the `github-pages` environment and deployment-specific Pages/OIDC permissions. It does not publish installers or application releases. Repository Pages must use the GitHub Actions source; local checks are not evidence of a hosted deployment.

Canonical/social URLs and download availability must reflect the chosen public release before publication. Do not advertise browser component fixtures as a working audio player or complete App trial.

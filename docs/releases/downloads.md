Phémios includes its local Aède engine; a separate server is optional. The [0.3.0 release notes](v0.3.0.md) and [GitHub release](https://github.com/craft-and-code/phemios/releases/tag/v0.3.0) provide exact download/checksum links. This generic matrix documents naming; tagged workflows use their own `docs/releases/vVERSION.md` notes.

| System                             | Installer                                                                  |
| ---------------------------------- | -------------------------------------------------------------------------- |
| macOS, Apple Silicon (M1 or later) | `phemios-App-VERSION-macOS-AppleSilicon.dmg`                               |
| Windows x64                        | `phemios-App-VERSION-Windows-x64.msi` or `.exe` (choose one)               |
| Linux x86_64                       | `phemios-App-VERSION-Linux-x86_64.AppImage`, `.deb` or `.rpm` (choose one) |

Each installer has its own `.sha256` checksum. macOS builds use ad-hoc integrity signing without Apple notarization; Windows installers remain unsigned. Gatekeeper and SmartScreen may require explicit approval. Intel macOS and ARM Linux installers are not produced by this matrix. FFmpeg and optional device tools such as podkit are not bundled. Physical audio, CD and portable-device acceptance remains separate from CI checks.

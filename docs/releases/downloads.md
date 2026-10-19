Phémios includes its local Aède engine; a separate server is optional.

| System                             | Installer                                                                  |
| ---------------------------------- | -------------------------------------------------------------------------- |
| macOS, Apple Silicon (M1 or later) | `phemios-App-VERSION-macOS-AppleSilicon.dmg`                               |
| Windows x64                        | `phemios-App-VERSION-Windows-x64.msi` or `.exe` (choose one)               |
| Linux x86_64                       | `phemios-App-VERSION-Linux-x86_64.AppImage`, `.deb` or `.rpm` (choose one) |

Each installer has its own `.sha256` checksum. These initial builds are unsigned; macOS Gatekeeper and Windows SmartScreen may require explicit approval. Intel macOS and ARM Linux installers are not produced by this matrix. FFmpeg and optional device tools such as podkit are not bundled. Physical audio, CD and portable-device acceptance remains separate from CI checks.

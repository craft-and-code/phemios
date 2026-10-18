# CD image fixtures

`ramp.wav`, `ramp.flac` and `ramp.ape` contain the same original synthetic stereo signal: 225 sectors (132,300 frames), 44,100 Hz, signed 16-bit samples. Left sample `i` is `(i % 30001) - 15000`; right is its opposite. No third-party recording is included. The fixtures are provided under the repository license.

Run `generate.py` with the reference `flac` encoder and a standalone Monkey’s Audio `mac` encoder on PATH. APE was generated with the Unix port of Monkey’s Audio 3.99 from <https://github.com/fernandotcl/monkeys-audio>; the encoder is not included or linked into Phémios. FLAC/WAV tests always run. APE tests exercise a real installed FFmpeg/FFprobe; they refuse to claim APE verification when the executables are absent.

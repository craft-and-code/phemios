"""Generate original deterministic CD-quality test PCM and lossless encodings.
Requires flac and a standalone Monkey's Audio `mac` encoder on PATH.
No recordings, tags or externally licensed audio are used.
"""
import struct
import subprocess
import wave
from pathlib import Path
root = Path(__file__).parent
with wave.open(str(root / "ramp.wav"), "wb") as output:
    output.setparams((2, 2, 44100, 0, "NONE", "not compressed"))
    output.writeframes(b"".join(struct.pack("<hh", (i % 30001) - 15000, 15000 - (i % 30001)) for i in range(225 * 588)))
subprocess.run(["flac", "--silent", "--force", str(root / "ramp.wav"), "-o", str(root / "ramp.flac")], check=True)
subprocess.run(["mac", str(root / "ramp.wav"), str(root / "ramp.ape"), "-c2000"], check=True)

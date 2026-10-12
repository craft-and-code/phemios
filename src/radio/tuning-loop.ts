/** Three original local feedback textures, not recordings or station frequencies. */
export const radioTuningPresets = ["static", "whistle", "flutter"] as const;
export type RadioTuningPreset = (typeof radioTuningPresets)[number];
/** One second of mono PCM; a short silent seam avoids clicks when looping the noise. */
export function radioTuningLoop(
  preset: RadioTuningPreset,
  rate: number,
): Float32Array<ArrayBuffer> {
  if (!Number.isSafeInteger(rate) || rate < 8000 || rate > 192000)
    throw new Error("Invalid tuning sample rate");
  const result = new Float32Array(rate),
    tau = Math.PI * 2;
  let seed = 173;
  for (let index = 0; index < rate; index++) {
    const t = index / rate;
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const noise = seed / 2147483648 - 1;
    const seam = Math.min(1, index / (rate * 0.008), (rate - 1 - index) / (rate * 0.008));
    let value: number;
    switch (preset) {
      case "static":
        value = noise * (0.28 + 0.12 * Math.sin(tau * 7 * t)) + 0.06 * Math.sin(tau * 360 * t);
        break;
      case "whistle":
        value =
          0.25 * Math.sin(tau * 620 * t + 9 * Math.sin(tau * 2 * t)) +
          noise * 0.12 +
          0.06 * Math.sin(tau * 1100 * t);
        break;
      case "flutter":
        value =
          (noise * 0.26 + 0.22 * Math.sin(tau * 240 * t + 5 * Math.sin(tau * 11 * t))) *
          (0.4 + 0.6 * Math.pow(Math.sin(tau * 4 * t), 2));
        break;
    }
    result[index] = seam === 0 ? 0 : value * seam;
  }
  return result;
}

/** Bound measured PCM to the dial; silence/unavailable samples retain its gently travelling idle wave. */
export function radioWaveform(
  samples: Float32Array,
  phase: number,
): { path: string; measured: boolean } {
  const measured = samples.some((value) => Number.isFinite(value) && Math.abs(value) > 0.0001);
  const points = 128;
  let path = "";
  for (let index = 0; index <= points; index++) {
    const sample =
      samples[Math.min(samples.length - 1, Math.floor((index * samples.length) / points))] ?? 0;
    const value = measured
      ? Number.isFinite(sample)
        ? Math.max(-1, Math.min(1, sample))
        : 0
      : 0.28 * Math.sin((index * Math.PI) / 7 - phase);
    path += `${index ? "L" : "M"}${((index * 900) / points).toFixed(1)} ${(65 - value * 45).toFixed(1)} `;
  }
  return { path, measured };
}

/** A consumed-output spectrum sample; position is in milliseconds, not wall-clock time. */
export interface BassSample {
  levels: readonly number[];
  frequencies: readonly number[];
  position: number;
  reference: string;
}
/** Relative low-band attacks, capped to one echo per 300 ms; no random beat or extra polling. */
export function createBassPulse() {
  let reference = "",
    previous = -1,
    baseline = 0,
    lastLevel = 0,
    lastPulse = -Infinity;
  function reset() {
    reference = "";
    previous = -1;
    baseline = 0;
    lastLevel = 0;
    lastPulse = -Infinity;
  }
  return {
    reset,
    observe(sample: BassSample): number {
      if (!Number.isFinite(sample.position) || sample.position < 0) {
        reset();
        return 0;
      }
      let sum = 0,
        count = 0;
      for (let i = 0; i < Math.min(24, sample.levels.length, sample.frequencies.length); i++) {
        const hz = sample.frequencies[i]!,
          level = sample.levels[i]!;
        if (Number.isFinite(hz) && hz >= 20 && hz <= 180 && Number.isFinite(level)) {
          sum += Math.max(0, Math.min(1, level));
          count++;
        }
      }
      if (!count) {
        reset();
        return 0;
      }
      const level = sum / count,
        time = sample.position;
      if (
        reference !== sample.reference ||
        previous < 0 ||
        time < previous ||
        time - previous > 1500
      ) {
        reference = sample.reference;
        previous = time;
        baseline = lastLevel = level;
        lastPulse = -Infinity;
        return 0;
      }
      if (time === previous) return 0;
      const attack =
        level >= 0.045 &&
        level > baseline * 1.3 + 0.008 &&
        level - lastLevel > 0.012 &&
        time - lastPulse >= 300;
      baseline += (level - baseline) * (1 - Math.exp(-(time - previous) / 400));
      lastLevel = level;
      previous = time;
      if (!attack) return 0;
      lastPulse = time;
      return Math.min(1, level);
    },
  };
}

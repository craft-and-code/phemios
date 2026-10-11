interface Band {
  level: number;
  peak: number;
  held: number;
}
/** Aède terminal policy: twelve neighbouring maxima, 350 ms peak hold, .45/s decay. */
export function createTerminalBands() {
  let rows: Band[] = [],
    previous = 0,
    identity = "";
  return {
    observe(
      levels: readonly number[] | undefined,
      position: number,
      reference: string,
    ): readonly Band[] {
      if (levels === undefined) return rows;
      const time = Math.max(0, Number.isFinite(position) ? position : 0);
      if (reference !== identity || time < previous) rows = [];
      identity = reference;
      rows = Array.from({ length: 12 }, (_, i) => {
        const level = Math.max(
          ...[levels[i * 2], levels[i * 2 + 1]].map((value) =>
            Number.isFinite(value) ? Math.max(0, Math.min(1, value ?? 0)) : 0,
          ),
        );
        const old = rows[i] ?? { level: 0, peak: 0, held: time };
        const peak = Math.max(
          0,
          old.peak - (Math.max(0, time - Math.max(previous, old.held)) / 1000) * 0.45,
        );
        return level >= peak
          ? { level, peak: level, held: time + 350 }
          : { level, peak, held: old.held };
      });
      previous = time;
      return rows;
    },
  };
}

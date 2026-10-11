/** Circular keyboard movement skips unavailable choices and never selects an absent row. */
export function nextChoice(
  options: readonly { disabled?: boolean }[],
  current: number,
  delta: 1 | -1,
): number {
  if (!options.length) return -1;
  for (let distance = 1; distance <= options.length; distance++) {
    const index =
      (((current + distance * delta) % options.length) + options.length) % options.length;
    if (!options[index]?.disabled) return index;
  }
  return -1;
}

/** Bounded, accent-insensitive typeahead with prefix expiry and repeated-letter cycling. */
export function createChoiceTypeahead(
  options: () => readonly { label: string; disabled?: boolean }[],
) {
  let prefix = "",
    last = -Infinity;
  const normalized = (value: string) =>
    value.normalize("NFKD").replace(/\p{M}/gu, "").toLocaleLowerCase();
  return {
    reset: () => {
      prefix = "";
      last = -Infinity;
    },
    find: (key: string, at: number, current: number) => {
      if (at - last > 700 || at < last || prefix.length >= 64) prefix = "";
      last = at;
      prefix += normalized(key);
      const repeated = [...prefix].every((letter) => letter === prefix[0]);
      const query = repeated ? (prefix[0] ?? "") : prefix;
      const rows = options();
      const start = repeated ? Math.max(0, current + 1) : 0;
      for (let step = 0; step < rows.length; step++) {
        const index = (start + step) % rows.length,
          row = rows[index];
        if (row && !row.disabled && normalized(row.label).startsWith(query)) return index;
      }
      return -1;
    },
  };
}

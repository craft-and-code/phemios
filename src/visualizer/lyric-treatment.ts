import { phraseOrientation } from "./floating";
export interface LyricTypography {
  track: string;
  phase: number;
}
const hashText = (text: string) =>
  [...text].reduce(
    (value, letter) => (Math.imul(value, 31) + (letter.codePointAt(0) ?? 0)) >>> 0,
    0,
  );
/** Three contiguous acts permit at most two font changes in ordinary cue order; unknown counts stay in act one. */
export function lyricAct(index: number, count: number): number {
  if (!Number.isSafeInteger(index) || !Number.isSafeInteger(count) || count <= 0) return 0;
  return Math.min(2, Math.floor((3 * Math.max(0, Math.min(index, count - 1))) / count));
}
/** Punctuation, supplied line breaks and joining words guide at most four readable groups, without invented timings. */
function phraseGroups(text: string): string[] {
  const clauses: string[] = [],
    pending: string[] = [];
  const flush = () => {
    if (pending.length) {
      clauses.push(pending.join(" "));
      pending.length = 0;
    }
  };
  for (const line of text.trim().split(/\n+/)) {
    for (const word of line.split(/\s+/)) {
      pending.push(word);
      if (/[,:;.!?—]$/.test(word)) flush();
    }
    flush();
  }
  if (clauses.length > 1)
    return clauses.length <= 4 ? clauses : [...clauses.slice(0, 3), clauses.slice(3).join(" ")];
  const words = text.trim().split(/\s+/);
  if (words.length <= 5) return [text.trim()];
  const groups: string[] = [],
    target = Math.max(2, Math.ceil(words.length / 3));
  const joining = /^(and|but|or|yet|et|mais|ou|car)$/i;
  const unfinished =
    /^(the|a|an|of|to|in|on|for|le|la|les|de|du|des|un|une|à|au|aux|et|and|into)$/i;
  const push = () => {
    if (pending.length && groups.length < 3) {
      groups.push(pending.join(" "));
      pending.length = 0;
    }
  };
  for (const word of words) {
    if (joining.test(word) && pending.length >= 2) push();
    pending.push(word);
    if (pending.length >= target && !unfinished.test(word)) push();
  }
  if (pending.length) {
    if (pending.length < 2 && groups.length) groups[groups.length - 1] += " " + pending.join(" ");
    else groups.push(pending.join(" "));
  }
  return groups;
}
/** Cue compositions vary while a track keeps its font within each act. System fonts require no downloaded assets. */
export function lyricTreatment(
  text: string,
  cue: string | number,
  typography: LyricTypography = { track: "", phase: 0 },
) {
  const seed = `${cue}:${text}`,
    hash = hashText(seed),
    groups = phraseGroups(text),
    composition = hash % 3;
  const phase = Number.isSafeInteger(typography.phase)
    ? Math.max(0, Math.min(2, typography.phase))
    : 0;
  const emphasis = groups.reduce(
    (best, group, index) => (group.length >= groups[best]!.length ? index : best),
    0,
  );
  const chunks = groups.map((text, index) => ({
    text,
    emphasis: index === emphasis,
    size:
      index === emphasis
        ? [1.22, 1.35, 1.3][composition]!
        : [0.68, 0.82, 0.74][(hash + index) % 3]!,
    tilt: index === emphasis ? 0 : index % 2 ? -8 : 8,
    depth: index === emphasis ? 42 : -28 - index * 8,
    yaw: index === emphasis ? -10 : index % 2 ? 18 : -18,
    offset: composition === 1 ? (index % 2 ? 0.12 : -0.12) : 0,
  }));
  const base = phraseOrientation(seed),
    angle = Math.sign(base) * (Math.abs(base) + (hash % 3) * 12);
  return {
    angle,
    font: (hashText(typography.track) + phase) % 4,
    size: [1, 0.85, 1.1, 0.95][hash % 4]!,
    duration: 9 + (hash % 7),
    yaw: [-24, 12, 24, -12][hash % 4]!,
    composition,
    chunks,
  };
}

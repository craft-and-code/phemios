import { phraseOrientation } from "./floating";
/** Bounded, deterministic typography changes with real cues; no synthetic word timings or downloaded fonts. */
export function lyricTreatment(text: string, cue: string | number) {
  const seed = `${cue}:${text}`;
  const hash = [...seed].reduce(
    (value, letter) => (Math.imul(value, 31) + (letter.codePointAt(0) ?? 0)) >>> 0,
    0,
  );
  const words = text.trim().split(/\s+/),
    group = Math.max(1, Math.ceil(words.length / 6));
  const chunks = [];
  for (let i = 0; i < words.length; i += group) {
    const variant = (hash + i / group) % 4;
    chunks.push({
      text: words.slice(i, i + group).join(" "),
      size: [0.7, 0.92, 1.12, 1.3][variant]!,
      tilt: [-4, 0, 4, 0][variant]!,
      delay: -(i / group) * 0.8,
    });
  }
  const base = phraseOrientation(seed),
    angle = Math.sign(base) * (Math.abs(base) + (hash % 3) * 12);
  return {
    angle,
    font: hash % 4,
    size: [1, 0.85, 1.1, 0.95][hash % 4]!,
    duration: 9 + (hash % 7),
    yaw: [-24, 12, 24, -12][hash % 4]!,
    chunks,
  };
}

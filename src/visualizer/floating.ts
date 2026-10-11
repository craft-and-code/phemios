import type { Particle } from "./particles";
/** Bounded orbital objects expand with native audible energy; no synthetic random meters. */
export function floatingObjects(time: number, levels: readonly number[], count = 32): Particle[] {
  const clock = Number.isFinite(time) ? time : 0;
  const total = Number.isFinite(count) ? Math.max(0, Math.min(48, Math.floor(count))) : 32;
  return Array.from({ length: total }, (_, i) => {
    const raw = levels[i % 4] ?? 0,
      energy = Number.isFinite(raw) ? Math.max(0, Math.min(1, raw)) : 0;
    const angle = i * 2.39996 + clock * (0.3 + (i % 3) * 0.06),
      radius = 0.6 + (i % 5) * 0.27 + energy * 0.2;
    return {
      x: Math.cos(angle) * radius,
      y: Math.sin(angle * 0.7 + i) * 0.8,
      z: Math.sin(angle) * radius,
      energy,
    };
  });
}
/** Visibility, user disable and accessibility preferences stop animation work altogether. */
export function animationRuns(
  enabled: boolean,
  playing: boolean,
  hidden: boolean,
  reduced: boolean,
) {
  return enabled && playing && !hidden && !reduced;
}

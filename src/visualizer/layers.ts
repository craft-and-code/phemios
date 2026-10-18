import type { Scene } from "./particles";
/** Frequency visibility is independent of the selected decorative scene. */
export function playbackLayers(scene: Scene, spectrum: boolean, available: boolean) {
  return { canvas: scene !== "off", frequencies: spectrum && available };
}

/** Each lyric presentation retains its own visibility when switching decorative scenes. */
export function playbackWords(scene: Scene, ordinary: boolean, floating = true): boolean {
  return scene === "floating" ? floating : ordinary;
}

/** One control cycles both retained styles before hiding the independent frequency layer. */
export function nextFrequencyMode(visible: boolean, style: "gradient" | "terminal") {
  return !visible
    ? { visible: true, style: "gradient" as const }
    : style === "gradient"
      ? { visible: true, style: "terminal" as const }
      : { visible: false, style: "terminal" as const };
}

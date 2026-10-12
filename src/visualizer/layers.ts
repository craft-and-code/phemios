import type { Scene } from "./particles";
/** Frequency visibility is independent of the selected decorative scene. */
export function playbackLayers(scene: Scene, spectrum: boolean, available: boolean) {
  return { canvas: scene !== "off", frequencies: spectrum && available };
}

/** The ordinary-words switch does not disable the separately selected floating-lyrics scene. */
export function playbackWords(scene: Scene, ordinary: boolean): boolean {
  return scene === "floating" || ordinary;
}

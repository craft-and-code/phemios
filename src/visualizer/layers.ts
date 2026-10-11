import type { Scene } from "./particles";
/** Frequency visibility is independent of the selected decorative scene. */
export function playbackLayers(scene: Scene, spectrum: boolean, available: boolean) {
  return { canvas: scene !== "off", frequencies: spectrum && available };
}

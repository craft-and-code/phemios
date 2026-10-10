import type { Filters } from "./types";
/** The year rail precedes the alphabet rail; hidden rails never duplicate a count. */
export function countRail(mode: Filters["mode"]): "years" | "alphabet" | undefined {
  return mode === "both" || mode === "years"
    ? "years"
    : mode === "alphabet"
      ? "alphabet"
      : undefined;
}

import { expect, it } from "vitest";
import { contextualReference, repeatDisabled } from "./contextual-play";
it("prefers the detail target, then the front cover, then the first enabled visible result", () => {
  const rows = [
    { reference: "track:first", disabled: false, central: false, visible: true },
    { reference: "album:front", disabled: false, central: true, visible: true },
  ];
  expect(contextualReference("album:detail", rows)).toBe("album:detail");
  expect(contextualReference("", rows)).toBe("album:front");
  expect(contextualReference("", [{ ...rows[1]!, disabled: true }, rows[0]!])).toBe("track:first");
  expect(contextualReference("", [{ ...rows[0]!, visible: false }])).toBe("");
});
it("repeat is unavailable until audio is actually active", () => {
  for (const status of ["idle", "connecting", "ended", "error"])
    expect(repeatDisabled(status, false, true, false)).toBe(true);
  for (const status of ["playing", "paused"])
    expect(repeatDisabled(status, false, true, false)).toBe(false);
  expect(repeatDisabled("playing", true, true, false)).toBe(true);
  expect(repeatDisabled("playing", false, true, true)).toBe(true);
});

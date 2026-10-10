import { expect, it } from "vitest";
import { defaultShortcuts, parseShortcuts, shortcutAction } from "./shortcuts";
const event = (code: string, modifier: "ctrlKey" | "metaKey" = "metaKey") => ({
  code,
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  shiftKey: false,
  repeat: false,
  [modifier]: true,
});
it("supports Command and Control while preserving editing, repeated key and modifier isolation", () => {
  expect(shortcutAction(event("KeyF"), defaultShortcuts, false)).toBe("search");
  expect(shortcutAction(event("KeyF", "ctrlKey"), defaultShortcuts, false)).toBe("search");
  expect(shortcutAction(event("KeyF"), defaultShortcuts, true)).toBeUndefined();
  expect(
    shortcutAction({ ...event("KeyF"), repeat: true }, defaultShortcuts, false),
  ).toBeUndefined();
  expect(
    shortcutAction({ ...event("KeyF"), altKey: true }, defaultShortcuts, false),
  ).toBeUndefined();
});
it("refuses conflicting/corrupt preferences instead of silently resetting saved shortcuts", () => {
  expect(() => parseShortcuts(JSON.stringify({ ...defaultShortcuts, mute: "Space" }))).toThrow();
  expect(() => parseShortcuts("broken")).toThrow();
  expect(parseShortcuts(JSON.stringify({ ...defaultShortcuts, mute: "" })).mute).toBe("");
});

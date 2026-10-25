import { expect, it } from "vitest";
import { iconNames, resolveIcon } from "./icon-symbols";

it("resolves the complete saved/navigation vocabulary while retaining neutral unknown symbols", () => {
  for (const name of iconNames) expect(typeof resolveIcon(name)).toBe("function");
  for (const name of ["", "unknown-old-menu", "toString", "__proto__"])
    expect(resolveIcon(name)).toBe(resolveIcon("list"));
});
it("keeps opposite transport actions and confirmed synchronized lyrics visually distinct", () => {
  for (const [a, b] of [
    ["play", "pause"],
    ["grid", "list"],
    ["grid", "cover-flow"],
    ["previous", "next"],
    ["volume", "muted"],
    ["lyrics", "lyrics-timed"],
    ["eye", "eye-off"],
  ] as const)
    expect(resolveIcon(a)).not.toBe(resolveIcon(b));
});

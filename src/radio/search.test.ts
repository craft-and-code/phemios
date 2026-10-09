import { expect, it } from "vitest";
import { radioEnterSearch } from "./search";
it("submits station/country/style fields with Enter but preserves IME and other control keys", () => {
  expect(radioEnterSearch("Enter", false, "text")).toBe(true);
  expect(radioEnterSearch("Enter", false, "search")).toBe(true);
  for (const args of [
    ["Enter", true, "text"],
    ["Enter", false, "checkbox"],
    ["Enter", false, "submit"],
    ["ArrowDown", false, "text"],
  ] as const)
    expect(radioEnterSearch(args[0], args[1], args[2])).toBe(false);
});

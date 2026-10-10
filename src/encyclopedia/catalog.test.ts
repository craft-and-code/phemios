import { expect, it } from "vitest";
import { encyclopediaRows } from "./catalog";
it("searches translated offline articles independently of their category", () => {
  expect(encyclopediaRows("guerre", "", "fr")[0]?.id).toBe("loudness-war");
  expect(encyclopediaRows("lossless", "glossary", "en").some((r) => r.id === "lossless")).toBe(
    true,
  );
  expect(encyclopediaRows("MD5", "history", "fr")).toEqual([]);
  expect(encyclopediaRows("", "", "fr").every((r) => r.source.url.startsWith("https://"))).toBe(
    true,
  );
});

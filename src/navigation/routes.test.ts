import { expect, it } from "vitest";
import { parseRoute } from "./routes";

it("opens stable references and refuses unknown or malformed URLs", () => {
  expect(parseRoute("#/artist/artist%3Astable")).toEqual({
    kind: "artist",
    reference: "artist:stable",
  });
  expect(parseRoute("#/tags")).toEqual({ kind: "section", section: "tags" });
  expect(parseRoute("#/unexpected")).toEqual({ kind: "not-found" });
  expect(parseRoute("#/artist/%XX")).toEqual({ kind: "not-found" });
  expect(parseRoute("")).toEqual({ kind: "section", section: "artists" });
});

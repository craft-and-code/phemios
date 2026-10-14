import { expect, it } from "vitest";
import { engineVersions } from "./product-versions";
it("keeps older unknown versions unknown and validates reported component identities", () => {
  expect(engineVersions(undefined)).toBeUndefined();
  expect(engineVersions({ aede: "0.4.0", flaccompagnon: "0.9.5" })).toEqual({
    aede: "0.4.0",
    flaccompagnon: "0.9.5",
  });
  for (const value of [
    null,
    {},
    { aede: "0.4.0", flaccompagnon: "unknown" },
    { aede: "0.4.0", flaccompagnon: "1.2.3\n" },
  ])
    expect(() => engineVersions(value)).toThrow();
});

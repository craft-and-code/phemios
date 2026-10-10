import { expect, it } from "vitest";
import { countRail } from "./result-count";
it("puts results on the first visible rail only", () => {
  expect(countRail("both")).toBe("years");
  expect(countRail("years")).toBe("years");
  expect(countRail("alphabet")).toBe("alphabet");
  expect(countRail("none")).toBeUndefined();
});

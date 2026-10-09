import { it, expect } from "vitest";
import { referenceSource } from "./sources";
it("distinguishes colliding identities and legacy remote cache", () => {
  expect(referenceSource("artist:@phemios/local/signal")).toBe("local");
  expect(referenceSource("artist:@phemios/server/signal")).toBe("server");
  expect(referenceSource("artist:signal")).toBe("server");
});

import { describe, it, expect } from "vitest";
import { readHqPlayer } from "./hqplayer-settings";
describe("HQPlayer device settings", () => {
  it("retains an explicit local endpoint without automatically connecting", () => {
    expect(readHqPlayer(null).port).toBe(4321);
    const value = { host: "192.168.1.5", port: 4321, from: "/music", to: "/shared" };
    expect(readHqPlayer(JSON.stringify(value))).toEqual(value);
  });
  it("refuses corrupt stores, credentials and incomplete mappings", () => {
    for (const raw of [
      "broken",
      "{}",
      JSON.stringify({ host: "user@host", port: 4321, from: "", to: "" }),
      JSON.stringify({ host: "host", port: 0, from: "", to: "" }),
      JSON.stringify({ host: "host", port: 4321, from: "/music", to: "" }),
    ])
      expect(() => readHqPlayer(raw)).toThrow();
  });
});

import { describe, expect, it } from "vitest";
import { canRemoveConcertKey } from "./concert-config";

describe("explicit JamBase key removal", () => {
  it("permits recovery when an invalid retained key prevents reading its presence", () => {
    expect(canRemoveConcertKey(true, false, { ready: false, error: "Clé JamBase invalide." })).toBe(
      true,
    );
  });

  it("requires an idle native host even when the retained key is unreadable", () => {
    const invalid = { ready: false, error: "Clé JamBase invalide." };
    expect(canRemoveConcertKey(false, false, invalid)).toBe(false);
    expect(canRemoveConcertKey(true, true, invalid)).toBe(false);
  });

  it("does not offer removal while loading or after a confirmed absence", () => {
    expect(canRemoveConcertKey(true, false, undefined)).toBe(false);
    expect(canRemoveConcertKey(true, false, { ready: false })).toBe(false);
    expect(canRemoveConcertKey(true, false, { ready: true })).toBe(true);
  });
});

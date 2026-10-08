import { describe, expect, it } from "vitest";
import { parsePlayback, parseOutputs } from "./playback-state";
const state = {
  status: "paused",
  reference: "track:one",
  index: 0,
  total: 2,
  position_ms: 1234,
  duration_ms: null,
  sample_rate: 48000,
  volume: 0.25,
  history_confirmed: true,
  device: "",
  error: "",
};
describe("native player state", () => {
  it("retains unknown duration and actual consumed position", () => {
    expect(parsePlayback(state).duration_ms).toBeNull();
    expect(parsePlayback(state).position_ms).toBe(1234);
    expect(parseOutputs([{ id: "output:one", name: "Speakers", default: true }])[0]?.default).toBe(
      true,
    );
  });
  it("refuses invalid clocks, indices, volume and ambiguous outputs", () => {
    for (const change of [
      { position_ms: -1 },
      { index: 2 },
      { volume: 2 },
      { duration_ms: "0" },
      { status: "unknown" },
      { total: 4097 },
    ])
      expect(() => parsePlayback({ ...state, ...change })).toThrow();
    expect(() =>
      parseOutputs([
        { id: "x", name: "a", default: false },
        { id: "x", name: "b", default: false },
      ]),
    ).toThrow();
  });
});

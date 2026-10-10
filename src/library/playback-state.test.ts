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

it("rejects invalid meters and preserves measured levels without inventing activity", () => {
  expect(parsePlayback({ ...state, levels: [0.1, 0.4, 0.2, 0.7] }).levels).toEqual([
    0.1, 0.4, 0.2, 0.7,
  ]);
  expect(() => parsePlayback({ ...state, levels: [0.1, 0.2] })).toThrow();
  expect(() => parsePlayback({ ...state, levels: [0, 0, 0, 1.1] })).toThrow();
  expect(parsePlayback(state).levels).toEqual([0, 0, 0, 0]);
});
it("validates seek acknowledgements and the FlacCompagnon output level", () => {
  expect(parsePlayback(state).seek_id).toBe(0);
  expect(parsePlayback({ ...state, seek_id: 7, level: 0.6 }).seek_id).toBe(7);
  for (const seek_id of [-1, 1.5, "7"])
    expect(() => parsePlayback({ ...state, seek_id })).toThrow();
  for (const level of [-0.1, 1.1, "0.6"])
    expect(() => parsePlayback({ ...state, level })).toThrow();
});

it("retains repeat modes and refuses unknown modes without inventing playback", () => {
  expect(parsePlayback({ ...state, repeat: "one" }).repeat).toBe("one");
  expect(parsePlayback(state).repeat).toBe("off");
  expect(() => parsePlayback({ ...state, repeat: "forever" })).toThrow();
});

import { expect, it } from "vitest";
import { addTransferSelection, transferProgress } from "./transfers";
import type { PlayableSelection } from "./playback-selection";
const track = (reference: string): PlayableSelection => ({
  reference,
  title: reference,
  album: null,
  artist: "Example",
  number: 1,
  albumTotal: 1,
});
it("deduplicates source files while preserving selection order and distinct library origins", () => {
  const a = track("track:@phemios/local/a"),
    b = track("track:@phemios/server/a");
  expect(addTransferSelection([a], [b, a]).map((r) => r.reference)).toEqual([
    a.reference,
    b.reference,
  ]);
  expect(() =>
    addTransferSelection(
      [],
      Array.from({ length: 4097 }, (_, i) => track(`track:${i}`)),
    ),
  ).toThrow();
});
it("does not mistake a downloaded original for a completed destination transfer", () => {
  expect(
    transferProgress({
      phase: "downloading",
      running: true,
      done: 1,
      total: 4,
      file_bytes: 100,
      file_total: 100,
    }),
  ).toBe(0.25);
  expect(transferProgress({ phase: "complete", running: false, done: 4, total: 4 })).toBe(1);
});

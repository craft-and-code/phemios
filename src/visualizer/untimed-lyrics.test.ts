import { createRoot, createSignal } from "solid-js";
import { expect, it } from "vitest";
import { createUntimedLyrics } from "./untimed-lyrics";
const words = {
  source: "tag",
  synced: false,
  lines: ["First", "Second", "Third"].map((text) => ({ text, at_ms: null })),
};
it("retains manual lyric navigation through playback clock polls and resets for another track", async () => {
  const value = createRoot((dispose) => {
    const [state, setState] = createSignal({ reference: "track:first", position: 0 });
    const cursor = createUntimedLyrics(
      () => state().reference,
      () => words,
    );
    return { ...cursor, setState, dispose };
  });
  await Promise.resolve();
  try {
    value.next();
    expect(value.index()).toBe(1);
    value.setState({ reference: "track:first", position: 250 });
    expect(value.index()).toBe(1);
    expect(value.lines()[value.index()]).toBe("Second");
    value.next();
    value.next();
    expect(value.index()).toBe(2);
    value.previous();
    expect(value.index()).toBe(1);
    value.setState({ reference: "track:second", position: 0 });
    expect(value.index()).toBe(0);
    value.previous();
    expect(value.index()).toBe(0);
  } finally {
    value.dispose();
  }
});

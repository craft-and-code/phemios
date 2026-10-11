import { createRoot, createSignal } from "solid-js";
import { expect, it } from "vitest";
import { createLyricReadiness } from "./lyric-readiness";
it("reveals a cue only after its own fitted composition is ready, rejecting older measurements", () => {
  createRoot((dispose) => {
    const first = { cue: 1000 },
      second = { cue: 2000 };
    const [phrase, setPhrase] = createSignal<typeof first | undefined>(first);
    const readiness = createLyricReadiness(phrase);
    expect(readiness.ready()).toBe(false);
    readiness.measured(first);
    expect(readiness.ready()).toBe(true);
    setPhrase(first);
    expect(readiness.ready()).toBe(true);
    setPhrase(second);
    expect(readiness.ready()).toBe(false);
    readiness.measured(first);
    expect(readiness.ready()).toBe(false);
    readiness.measured(second);
    expect(readiness.ready()).toBe(true);
    setPhrase(undefined);
    expect(readiness.ready()).toBe(false);
    dispose();
  });
});

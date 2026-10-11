import { createRoot, createSignal } from "solid-js";
import { expect, it } from "vitest";
import { createLyricPhrase } from "./lyric-motion";
import { phraseOrientation, floatingObjects } from "./floating";
it("restarts the arrival for repeated supplied cues while clock-only polls preserve its node", () => {
  createRoot((dispose) => {
    const [cue, setCue] = createSignal(1000),
      [floating, setFloating] = createSignal(false),
      [text, setText] = createSignal("Original fixture words");
    const phrase = createLyricPhrase(text, cue, floating),
      initial = phrase();
    setCue(1000);
    expect(phrase()).toBe(initial);
    setCue(2000);
    expect(phrase()).not.toBe(initial);
    expect(phrase()?.text).toBe(initial?.text);
    setFloating(true);
    expect(Math.abs(phrase()?.angle ?? 0)).toBeGreaterThanOrEqual(45);
    setText("");
    expect(phrase()).toBeUndefined();
    dispose();
  });
});
it("uses sparse musical motifs and both marked orientation directions", () => {
  expect(floatingObjects(0, [])).toHaveLength(7);
  const values = ["A", "B", "Original fixture", "Other fixture"].map(phraseOrientation);
  expect(values.some((v) => v <= -45)).toBe(true);
  expect(values.some((v) => v >= 45)).toBe(true);
  expect(values.every((v) => Math.abs(v) <= 55)).toBe(true);
});

import { createRoot, createSignal } from "solid-js";
import { expect, it } from "vitest";
import { createWaveformHover } from "./waveform-hover";

it("addresses the whole drawing and clears pointer targeting on leave or source availability changes", () => {
  createRoot((dispose) => {
    const [reference, setReference] = createSignal("track:first"),
      [disabled, setDisabled] = createSignal(false),
      cursor = createWaveformHover(reference, disabled);
    cursor.move(250, 100, 600, 240000);
    expect(cursor.position()).toBe(60000);
    cursor.move(700, 100, 600, 240000);
    expect(cursor.position()).toBe(240000);
    cursor.move(100, 100, 600, 240000);
    expect(cursor.position()).toBe(0);
    cursor.move(50, 100, 600, 240000);
    expect(cursor.position()).toBeUndefined();
    cursor.move(800, 100, 600, 240000);
    expect(cursor.position()).toBeUndefined();
    cursor.clear();
    expect(cursor.position()).toBeUndefined();
    cursor.move(300, 100, 600, 240000);
    setReference("track:next");
    expect(cursor.position()).toBeUndefined();
    setReference("track:first");
    expect(cursor.position()).toBeUndefined();
    cursor.move(400, 100, 600, 240000);
    setDisabled(true);
    expect(cursor.position()).toBeUndefined();
    setDisabled(false);
    expect(cursor.position()).toBeUndefined();
    dispose();
  });
});

it("does not show a target for idle or invalid timelines", () => {
  createRoot((dispose) => {
    const [disabled, setDisabled] = createSignal(true),
      cursor = createWaveformHover(() => "track:first", disabled);
    cursor.move(300, 100, 600, 240000);
    expect(cursor.position()).toBeUndefined();
    setDisabled(false);
    cursor.move(300, 100, 600, 240000);
    expect(cursor.position()).toBe(80000);
    cursor.move(300, 100, 600, 0);
    expect(cursor.position()).toBeUndefined();
    cursor.move(300, 100, 0, 240000);
    expect(cursor.position()).toBeUndefined();
    cursor.move(NaN, 100, 600, 240000);
    expect(cursor.position()).toBeUndefined();
    dispose();
  });
});

it("retains the hover line while the same track clock advances or acknowledges a click", () => {
  createRoot((dispose) => {
    const [state, setState] = createSignal({ reference: "track:first", position: 1000 }),
      cursor = createWaveformHover(
        () => state().reference,
        () => false,
      );
    cursor.move(250, 100, 600, 240000);
    expect(cursor.position()).toBe(60000);
    setState((current) => ({ ...current, position: 1500 }));
    expect(cursor.position()).toBe(60000);
    setState((current) => ({ ...current, position: 60000 }));
    expect(cursor.position()).toBe(60000);
    dispose();
  });
});

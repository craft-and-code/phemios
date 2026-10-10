import { createRoot, createSignal } from "solid-js";
import { afterEach, expect, it, vi } from "vitest";
import { createFeedback } from "./feedback";
afterEach(() => vi.useRealTimers());
it("expires, closes manually, restarts on new content and cleans up", async () => {
  vi.useFakeTimers();
  let dispose!: () => void,
    set!: (message: string) => void,
    state!: ReturnType<typeof createFeedback>;
  createRoot((end) => {
    dispose = end;
    const [message, update] = createSignal("Saved");
    set = update;
    state = createFeedback(message, () => 1000);
  });
  await Promise.resolve();
  expect(state.visible()).toBe(true);
  vi.advanceTimersByTime(1000);
  expect(state.visible()).toBe(false);
  set("New");
  expect(state.visible()).toBe(true);
  state.close();
  expect(state.visible()).toBe(false);
  set("Third");
  dispose();
  expect(vi.getTimerCount()).toBe(0);
});
it("pauses while reading, preserves remaining time and never closes newer content early", async () => {
  vi.useFakeTimers();
  let dispose!: () => void,
    set!: (message: string) => void,
    state!: ReturnType<typeof createFeedback>;
  createRoot((end) => {
    dispose = end;
    const [message, update] = createSignal("First");
    set = update;
    state = createFeedback(message, () => 1000);
  });
  await Promise.resolve();
  vi.advanceTimersByTime(400);
  state.pause(true);
  vi.advanceTimersByTime(3000);
  expect(state.visible()).toBe(true);
  state.pause(false);
  vi.advanceTimersByTime(599);
  expect(state.visible()).toBe(true);
  set("Second");
  vi.advanceTimersByTime(999);
  expect(state.visible()).toBe(true);
  vi.advanceTimersByTime(1);
  expect(state.visible()).toBe(false);
  dispose();
});

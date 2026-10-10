import { createRoot } from "solid-js";
import { expect, it } from "vitest";
import { createDirectoryCount } from "./directory-count";
it("does not serialize station changes behind a delayed optional count and ignores disposal", async () => {
  let finish!: (value: unknown) => void, dispose!: () => void;
  let counter!: ReturnType<typeof createDirectoryCount>;
  let calls = 0;
  createRoot((end) => {
    dispose = end;
    counter = createDirectoryCount(() => {
      calls++;
      return new Promise((resolve) => {
        finish = resolve;
      });
    });
  });
  counter.refresh();
  counter.refresh();
  expect(calls).toBe(1);
  expect(counter.value()).toBeUndefined();
  dispose();
  finish({ stations: 500 });
  await Promise.resolve();
  await Promise.resolve();
  expect(counter.value()).toBeUndefined();
});

it("keeps count failures recoverable without publishing a false zero", async () => {
  let dispose!: () => void, counter!: ReturnType<typeof createDirectoryCount>;
  let calls = 0;
  createRoot((end) => {
    dispose = end;
    counter = createDirectoryCount(async () => {
      if (++calls === 1) throw new Error("timeout");
      return { stations: 500 };
    });
  });
  counter.refresh();
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(counter.value()).toBeUndefined();
  expect(counter.error()).not.toBe("");
  counter.refresh();
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(counter.value()).toBe(500);
  expect(counter.error()).toBe("");
  dispose();
});

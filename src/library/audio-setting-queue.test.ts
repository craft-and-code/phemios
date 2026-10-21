import { expect, it, vi } from "vitest";
import { createAudioSettingQueue } from "./audio-setting-queue";

it("waits for the last coalesced choice without blocking numeric input", async () => {
  const owner = { lifetime: 0, profile: {} };
  let release!: () => void;
  const apply = vi
    .fn()
    .mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    )
    .mockResolvedValue(undefined);
  const choose = createAudioSettingQueue(() => owner, apply);
  const first = choose(0.1);
  await choose(0.2);
  await choose(0.3);
  let settled = false;
  const complete = choose.settled().then(() => {
    settled = true;
  });
  await Promise.resolve();
  expect(settled).toBe(false);
  release();
  await complete;
  await first;
  expect(apply.mock.calls.map((call) => call[0])).toEqual([0.1, 0.3]);
  expect(settled).toBe(true);
});

it("does not wait for a retired owner's unfinished setting", async () => {
  let owner = { lifetime: 0, profile: {} };
  let release!: () => void;
  const apply = vi
    .fn()
    .mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    )
    .mockResolvedValue(undefined);
  const choose = createAudioSettingQueue(() => owner, apply);
  const old = choose(0.1);
  let settled = false;
  const previous = choose.settled().then(() => {
    settled = true;
  });
  try {
    owner = { lifetime: 1, profile: {} };
    await choose.settled();
    await choose(0.7);
    await choose.settled();
    expect(settled).toBe(false);
    expect(apply.mock.calls.map((call) => call[0])).toEqual([0.1, 0.7]);
  } finally {
    release();
    await old;
    await previous;
  }
});

import { expect, it, vi } from "vitest";
import { createRadioTuningSound } from "./tuning-sound";
import { radioTuningLoop, radioTuningPresets, type RadioTuningPreset } from "./tuning-loop";
function setup(ready = Promise.resolve(), preset?: RadioTuningPreset) {
  let gain = 0.6;
  const voice = { stop: vi.fn() };
  const audio = {
    ready: vi.fn(() => ready),
    loop: vi.fn((_preset: RadioTuningPreset, _volume: number) => voice),
    volume: vi.fn(),
    dispose: vi.fn(),
    idle: vi.fn(),
  };
  const random = vi.fn(() => 0.45),
    error = vi.fn();
  const sound = createRadioTuningSound({
    audio,
    random,
    error,
    volume: () => gain,
    ...(preset ? { preset } : {}),
  });
  return {
    sound,
    audio,
    random,
    error,
    voice,
    gain: (value: number) => {
      gain = value;
    },
  };
}
async function settle() {
  for (let step = 0; step < 5; step++) await Promise.resolve();
}
it("chooses exactly one loop at the first real horizontal drag, never for a click", async () => {
  const view = setup();
  view.sound.begin({ id: 4, x: 100 });
  view.sound.move({ id: 4, x: 102 });
  view.sound.move({ id: 7, x: 180 });
  await settle();
  expect(view.audio.loop).not.toHaveBeenCalled();
  expect(view.random).not.toHaveBeenCalled();
  view.sound.finish();
  view.sound.begin({ id: 5, x: 50 });
  for (const x of [60, 80, 140, 90]) view.sound.move({ id: 5, x });
  await settle();
  expect(view.random).toHaveBeenCalledOnce();
  expect(view.audio.loop).toHaveBeenCalledExactlyOnceWith("whistle", 0.6);
  view.sound.finish();
  expect(view.voice.stop).toHaveBeenCalledOnce();
  view.sound.begin({ id: 6, x: 0 });
  view.sound.move({ id: 6, x: 10 });
  await settle();
  expect(view.random).toHaveBeenCalledTimes(2);
  view.sound.dispose();
});
it("tracks gain and mute independently of any stream, and releases the voice on disposal", async () => {
  const view = setup();
  view.gain(0);
  view.sound.begin({ id: 1, x: 0 });
  view.sound.move({ id: 1, x: 20 });
  await settle();
  expect(view.audio.loop).toHaveBeenCalledExactlyOnceWith("whistle", 0);
  view.sound.volume(0.4);
  view.sound.volume(0);
  expect(view.audio.volume.mock.calls).toEqual([[0.4], [0]]);
  view.sound.dispose();
  expect(view.voice.stop).toHaveBeenCalledOnce();
  expect(view.audio.dispose).toHaveBeenCalledOnce();
  view.sound.begin({ id: 2, x: 0 });
  view.sound.move({ id: 2, x: 20 });
  await settle();
  expect(view.audio.loop).toHaveBeenCalledOnce();
});
it("rejects a resumed context after release, replacement or unmount", async () => {
  let resume!: () => void;
  const view = setup(
    new Promise<void>((resolve) => {
      resume = resolve;
    }),
  );
  view.sound.begin({ id: 1, x: 0 });
  view.sound.move({ id: 1, x: 40 });
  view.sound.finish();
  view.sound.begin({ id: 2, x: 0 });
  view.sound.move({ id: 2, x: 40 });
  view.sound.dispose();
  resume();
  await settle();
  expect(view.audio.loop).not.toHaveBeenCalled();
  expect(view.audio.dispose).toHaveBeenCalledOnce();
});
it("reports unavailable feedback only for its active gesture without an unhandled rejection", async () => {
  const failure = new Error("Audio output unavailable");
  const view = setup(Promise.reject(failure));
  view.sound.begin({ id: 1, x: 0 });
  view.sound.move({ id: 1, x: 40 });
  await settle();
  expect(view.error).toHaveBeenCalledExactlyOnceWith(failure);
  expect(view.audio.loop).not.toHaveBeenCalled();
  view.sound.dispose();
});
it("synthesizes three distinct finite bounded loops with click-free endpoints", () => {
  const loops = radioTuningPresets.map((preset) => radioTuningLoop(preset, 48000));
  for (const loop of loops) {
    expect(loop).toHaveLength(48000);
    expect(loop[0]).toBe(0);
    expect(loop[loop.length - 1]).toBe(0);
    expect(loop.every((value) => Number.isFinite(value) && Math.abs(value) <= 0.7)).toBe(true);
    expect(loop.reduce((sum, value) => sum + value * value, 0)).toBeGreaterThan(1);
  }
  expect(new Set(loops.map((loop) => Array.from(loop.slice(1000, 1010)).join(","))).size).toBe(3);
  for (const rate of [0, 1.5, 7999, 192001, NaN, Infinity])
    expect(() => radioTuningLoop("static", rate)).toThrow();
});

it("keeps a replacement gesture audible when an older resume completes or another pointer releases", async () => {
  let resumed!: () => void;
  const view = setup(
    new Promise<void>((resolve) => {
      resumed = resolve;
    }),
  );
  view.random.mockReturnValueOnce(0).mockReturnValueOnce(0.99);
  view.sound.begin({ id: 1, x: 0 });
  view.sound.move({ id: 1, x: 20 });
  view.audio.ready.mockReturnValueOnce(Promise.resolve());
  view.sound.begin({ id: 2, x: 0 });
  view.sound.move({ id: 2, x: 20 });
  view.sound.finish(1);
  await settle();
  expect(view.audio.loop).toHaveBeenCalledExactlyOnceWith("flutter", 0.6);
  resumed();
  await settle();
  expect(view.audio.loop).toHaveBeenCalledOnce();
  expect(view.voice.stop).not.toHaveBeenCalled();
  view.sound.finish(2);
  expect(view.voice.stop).toHaveBeenCalledOnce();
  view.sound.dispose();
});
it("ignores a rejected resume after the gesture was cancelled", async () => {
  let rejected!: (failure: unknown) => void;
  const view = setup(
    new Promise<void>((_resolve, reject) => {
      rejected = reject;
    }),
  );
  view.sound.begin({ id: 1, x: 0 });
  view.sound.move({ id: 1, x: 20 });
  view.sound.finish();
  rejected(new Error("Late audio rejection"));
  await settle();
  expect(view.audio.loop).not.toHaveBeenCalled();
  expect(view.error).not.toHaveBeenCalled();
  view.sound.dispose();
});

it("uses the user's fixed whistle texture on every drag without sampling a random preset", async () => {
  const view = setup(Promise.resolve(), "whistle");
  view.random.mockReturnValue(0);
  for (const id of [1, 2]) {
    view.sound.begin({ id, x: 0 });
    view.sound.move({ id, x: 10 });
    await settle();
    view.sound.finish(id);
  }
  expect(view.audio.loop.mock.calls.map(([preset]) => preset)).toEqual(["whistle", "whistle"]);
  expect(view.random).not.toHaveBeenCalled();
  view.sound.dispose();
});

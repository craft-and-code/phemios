import { createRoot, createSignal } from "solid-js";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createDisplayAwake } from "./display-awake";
import { activateInterfaceProfile, interfacePreferences } from "./account-preferences";
vi.mock("../platform/desktop", () => ({ openAwakeScope: vi.fn(), updateAwakeScope: vi.fn() }));
const tick = async () => {
  for (let i = 0; i < 20; i++) await Promise.resolve();
};
let dispose: () => void;
beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("window", new EventTarget());
  const store = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, value),
  });
});
afterEach(() => {
  dispose?.();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
function setup(backend: {
  open: () => Promise<string>;
  update: (scope: string, active: boolean) => Promise<void>;
}) {
  return createRoot((cleanup) => {
    dispose = cleanup;
    const [playing, setPlaying] = createSignal(false);
    const awake = createDisplayAwake({ native: true, playing }, backend);
    return { awake, setPlaying };
  });
}
it("acquires only while audio is playing, renews one lease and releases on pause or disabling", async () => {
  const backend = { open: vi.fn(async () => "scope:1"), update: vi.fn(async () => {}) },
    state = setup(backend);
  await tick();
  expect(backend.open).not.toHaveBeenCalled();
  state.setPlaying(true);
  await tick();
  expect(backend.update).toHaveBeenLastCalledWith("scope:1", true);
  await vi.advanceTimersByTimeAsync(5000);
  expect(backend.open).toHaveBeenCalledTimes(1);
  expect(backend.update).toHaveBeenCalledTimes(2);
  state.setPlaying(false);
  await tick();
  expect(backend.update).toHaveBeenLastCalledWith("scope:1", false);
  state.setPlaying(true);
  await tick();
  state.awake.setEnabled(false);
  await tick();
  expect(backend.update).toHaveBeenLastCalledWith("scope:1", false);
  expect(interfacePreferences.getItem("phemios.keep-awake")).toBe("false");
  const count = backend.update.mock.calls.length;
  await vi.advanceTimersByTimeAsync(15000);
  expect(backend.update).toHaveBeenCalledTimes(count);
});
it("releases after an in-flight acquisition even if the owner is disposed meanwhile", async () => {
  let finish!: (value: string) => void;
  const backend = {
    open: vi.fn(
      () =>
        new Promise<string>((resolve) => {
          finish = resolve;
        }),
    ),
    update: vi.fn(async () => {}),
  };
  const state = setup(backend);
  state.setPlaying(true);
  await tick();
  dispose();
  finish("scope:old");
  await tick();
  expect(backend.update).not.toHaveBeenCalledWith("scope:old", true);
  expect(backend.update).toHaveBeenLastCalledWith("scope:old", false);
});
it("keeps playback untouched on native failure and releases after a lost acquisition acknowledgement", async () => {
  const backend = {
      open: vi.fn(async () => "scope:1"),
      update: vi.fn().mockRejectedValueOnce(Error("unavailable")).mockResolvedValue(undefined),
    },
    state = setup(backend);
  state.setPlaying(true);
  await tick();
  expect(state.awake.error()).toContain("unavailable");
  state.setPlaying(false);
  await tick();
  expect(backend.update).toHaveBeenLastCalledWith("scope:1", false);
  expect(state.awake.error()).toBe("");
});
it("reloads owner preferences without copying another account's choice and preserves malformed settings", async () => {
  interfacePreferences.setItem("phemios.keep-awake", "false");
  const backend = { open: vi.fn(async () => "scope:1"), update: vi.fn(async () => {}) },
    state = setup(backend);
  state.setPlaying(true);
  await tick();
  expect(backend.open).not.toHaveBeenCalled();
  interfacePreferences.setItem("phemios.keep-awake", "true");
  window.dispatchEvent(new Event("phemios-settings-loaded"));
  await tick();
  expect(backend.update).toHaveBeenLastCalledWith("scope:1", true);
  interfacePreferences.setItem("phemios.keep-awake", '"bad"');
  window.dispatchEvent(new Event("phemios-settings-loaded"));
  await tick();
  expect(backend.update).toHaveBeenLastCalledWith("scope:1", false);
  expect(state.awake.error()).not.toBe("");
  expect(interfacePreferences.getItem("phemios.keep-awake")).toBe('"bad"');
});

it("releases a paused request after its earlier activation rejects", async () => {
  let reject!: (error: Error) => void;
  const backend = {
      open: vi.fn(async () => "scope:1"),
      update: vi
        .fn()
        .mockImplementationOnce(
          () =>
            new Promise<void>((_, fail) => {
              reject = fail;
            }),
        )
        .mockResolvedValue(undefined),
    },
    state = setup(backend);
  state.setPlaying(true);
  await tick();
  state.setPlaying(false);
  reject(Error("lost response"));
  await tick();
  expect(backend.update).toHaveBeenLastCalledWith("scope:1", false);
});
it("aggregates every source and never acquires for connecting, paused or ended audio", async () => {
  const { anyAudioPlaying } = await import("./display-awake");
  for (const states of [
    ["playing", "idle", "idle"],
    ["paused", "playing", "idle"],
    ["idle", "idle", "playing"],
  ])
    expect(anyAudioPlaying(...states)).toBe(true);
  expect(anyAudioPlaying("paused", "connecting", "ended")).toBe(false);
});

it("renews while the audio clock keeps publishing unchanged playing states", async () => {
  const backend = { open: vi.fn(async () => "scope:1"), update: vi.fn(async () => {}) };
  let publish!: (value: { status: string; position: number }) => unknown;
  createRoot((cleanup) => {
    dispose = cleanup;
    const [audio, setAudio] = createSignal({ status: "playing", position: 0 });
    publish = setAudio;
    createDisplayAwake({ native: true, playing: () => audio().status === "playing" }, backend);
  });
  await tick();
  for (let i = 1; i <= 6; i++) {
    await vi.advanceTimersByTimeAsync(1000);
    publish({ status: "playing", position: i * 1000 });
    await tick();
  }
  expect(backend.update).toHaveBeenNthCalledWith(2, "scope:1", true);
});

it("keeps different accounts' awake choices separate across profile replacement", async () => {
  const backend = { open: vi.fn(async () => "scope:1"), update: vi.fn(async () => {}) },
    state = setup(backend);
  state.setPlaying(true);
  await tick();
  activateInterfaceProfile("account:a", (values) => values);
  window.dispatchEvent(new Event("phemios-settings-loaded"));
  state.awake.setEnabled(false);
  await tick();
  expect(backend.update).toHaveBeenLastCalledWith("scope:1", false);
  activateInterfaceProfile("account:b", (values) => values);
  window.dispatchEvent(new Event("phemios-settings-loaded"));
  await tick();
  expect(state.awake.enabled()).toBe(true);
  expect(backend.update).toHaveBeenLastCalledWith("scope:1", true);
  activateInterfaceProfile("account:a", (values) => values);
  window.dispatchEvent(new Event("phemios-settings-loaded"));
  await tick();
  expect(state.awake.enabled()).toBe(false);
  expect(backend.update).toHaveBeenLastCalledWith("scope:1", false);
});
it("never requests a native lease in the browser preview", async () => {
  const backend = { open: vi.fn(async () => "scope:1"), update: vi.fn(async () => {}) };
  createRoot((cleanup) => {
    dispose = cleanup;
    createDisplayAwake({ native: false, playing: () => true }, backend);
  });
  await tick();
  await vi.advanceTimersByTimeAsync(20000);
  expect(backend.open).not.toHaveBeenCalled();
  expect(backend.update).not.toHaveBeenCalled();
});

it("releases after a lost reactivation reply even when a previous pause was acknowledged", async () => {
  let reject!: (error: Error) => void;
  const backend = {
    open: vi.fn(async () => "scope:1"),
    update: vi.fn(async (_scope: string, _active: boolean) => {}),
  };
  const state = setup(backend);
  state.setPlaying(true);
  await tick();
  state.setPlaying(false);
  await tick();
  backend.update.mockImplementationOnce(
    () =>
      new Promise<void>((_resolve, fail) => {
        reject = fail;
      }),
  );
  state.setPlaying(true);
  await tick();
  state.setPlaying(false);
  reject(Error("reactivation reply lost"));
  await tick();
  expect(backend.update).toHaveBeenLastCalledWith("scope:1", false);
});

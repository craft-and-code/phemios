import { createRoot, createSignal } from "solid-js";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createNetworkAudio } from "./controller";
import { requestAede } from "../platform/desktop";
import type { AccountSession } from "../library/server";
vi.mock("../platform/desktop", () => ({ requestAede: vi.fn() }));
const request = vi.mocked(requestAede);
const owner: AccountSession = {
  server: "https://music.example",
  account: { id: "a", username: "a", role: "admin" },
};
let dispose: () => void;
beforeEach(() => {
  vi.useFakeTimers();
  request.mockImplementation(async (path) =>
    path === "/api/v1/status"
      ? { capabilities: ["network_audio_upnp"] }
      : path.endsWith("/discover")
        ? { items: [{ name: "Fixture renderer", endpoint: "http://192.168.1.20/device.xml" }] }
        : { id: 7, status: "running" },
  );
});
afterEach(() => {
  dispose?.();
  vi.clearAllTimers();
  vi.useRealTimers();
  request.mockReset();
});
function setup() {
  return createRoot((end) => {
    dispose = end;
    const [session, setSession] = createSignal<AccountSession | undefined>(owner);
    const beforeStart = vi.fn(async () => {});
    const audio = createNetworkAudio({
      source: () => "server",
      session: () => session(),
      queue: () => [{ reference: "track:one" }],
      beforeStart,
    });
    return { audio, setSession, beforeStart };
  });
}
it("performs no discovery until requested and binds commands to the exact session", async () => {
  const { audio, beforeStart } = setup();
  expect(request).not.toHaveBeenCalled();
  await audio.discover("192.168.1.10");
  await audio.start("192.168.1.10", "http://192.168.1.20/device.xml");
  expect(beforeStart).toHaveBeenCalledOnce();
  expect(request).toHaveBeenCalledWith(
    "/api/admin/v1/network-audio/play",
    {},
    "POST",
    { bind: "192.168.1.10", device: "http://192.168.1.20/device.xml", tracks: ["track:one"] },
    "server",
    owner,
  );
  expect(audio.active()).toBe(true);
});
it("clears devices and active status on logout and stops polling", async () => {
  const { audio, setSession } = setup();
  await audio.discover("192.168.1.10");
  await audio.start("192.168.1.10", "http://192.168.1.20/device.xml");
  setSession(undefined);
  expect(audio.devices()).toEqual([]);
  expect(audio.run()).toBeUndefined();
  request.mockClear();
  await vi.advanceTimersByTimeAsync(5000);
  expect(request).not.toHaveBeenCalled();
});
it("ignores discovery responses from the former account", async () => {
  const { audio, setSession } = setup();
  let resolve!: (value: unknown) => void;
  request.mockImplementationOnce(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  const pending = audio.discover("192.168.1.10");
  setSession(undefined);
  resolve({ capabilities: ["network_audio_upnp"] });
  await pending;
  expect(request).toHaveBeenCalledTimes(1);
  expect(audio.devices()).toEqual([]);
});
it("requests Stop for a late accepted play after the presentation owner changes", async () => {
  const { audio, setSession } = setup();
  await audio.discover("192.168.1.10");
  let resolve!: (value: unknown) => void;
  request.mockImplementationOnce(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  const pending = audio.start("192.168.1.10", "http://192.168.1.20/device.xml");
  await Promise.resolve();
  setSession({ ...owner, account: { ...owner.account, id: "b" } });
  resolve({ id: 7, status: "running" });
  await pending;
  expect(request).toHaveBeenCalledWith(
    "/api/admin/v1/network-audio/stop",
    {},
    "POST",
    { id: 7 },
    "server",
    owner,
  );
  expect(audio.run()).toBeUndefined();
});
it("waits for confirmed Stop and refuses foreign endpoints", async () => {
  const { audio } = setup();
  await audio.discover("192.168.1.10");
  await audio.start("192.168.1.10", "http://192.168.1.99/device.xml");
  expect(audio.error()).not.toBe("");
  await audio.start("192.168.1.10", "http://192.168.1.20/device.xml");
  request.mockResolvedValueOnce({ id: 7, status: "stopping" });
  await audio.stop();
  expect(audio.active()).toBe(true);
  request.mockResolvedValueOnce({ id: 7, status: "stopped" });
  await vi.advanceTimersByTimeAsync(1000);
  expect(audio.active()).toBe(false);
});

it("cancels a pending discovery without publishing its late result", async () => {
  const { audio } = setup();
  let resolve!: (value: unknown) => void;
  request.mockImplementationOnce(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  const pending = audio.discover("192.168.1.10");
  audio.cancelRead();
  resolve({ capabilities: ["network_audio_upnp"] });
  await pending;
  expect(audio.busy()).toBe(false);
  expect(audio.devices()).toEqual([]);
  expect(request).toHaveBeenCalledTimes(1);
});
it("keeps unsupported servers explicit without starting discovery", async () => {
  const { audio } = setup();
  request.mockResolvedValueOnce({ capabilities: [] });
  await audio.discover("192.168.1.10");
  expect(audio.error()).toContain("Aède");
  expect(request).toHaveBeenCalledTimes(1);
});

it("clears a transient polling error after the receiver status is recovered", async () => {
  const { audio } = setup();
  await audio.discover("192.168.1.10");
  await audio.start("192.168.1.10", "http://192.168.1.20/device.xml");
  request.mockRejectedValueOnce(new Error("Temporary network read failure"));
  await vi.advanceTimersByTimeAsync(1000);
  expect(audio.error()).toContain("Temporary network read failure");
  request.mockResolvedValueOnce({ id: 7, status: "stopped" });
  await vi.advanceTimersByTimeAsync(1000);
  expect(audio.active()).toBe(false);
  expect(audio.error()).toBe("");
});

it("does not erase a refused Stop command when polling succeeds", async () => {
  const { audio } = setup();
  await audio.discover("192.168.1.10");
  await audio.start("192.168.1.10", "http://192.168.1.20/device.xml");
  request.mockRejectedValueOnce(new Error("Stop command refused"));
  await audio.stop();
  request.mockResolvedValueOnce({ id: 7, status: "running" });
  await vi.advanceTimersByTimeAsync(1000);
  expect(audio.error()).toContain("Stop command refused");
  expect(audio.active()).toBe(true);
});
it("ignores a pending old-owner status failure after logout", async () => {
  const { audio, setSession } = setup();
  await audio.discover("192.168.1.10");
  await audio.start("192.168.1.10", "http://192.168.1.20/device.xml");
  let reject!: (error: Error) => void;
  request.mockImplementationOnce(
    () =>
      new Promise((_resolve, fail) => {
        reject = fail;
      }),
  );
  await vi.advanceTimersByTimeAsync(1000);
  setSession(undefined);
  reject(new Error("Former status failure"));
  for (let index = 0; index < 6; index++) await Promise.resolve();
  expect(audio.error()).toBe("");
  expect(audio.run()).toBeUndefined();
  expect(vi.getTimerCount()).toBe(0);
});
it("clears a recovered polling error when the server has no retained session", async () => {
  const { audio } = setup();
  await audio.discover("192.168.1.10");
  await audio.start("192.168.1.10", "http://192.168.1.20/device.xml");
  request.mockRejectedValueOnce(new Error("Transient failure"));
  await vi.advanceTimersByTimeAsync(1000);
  request.mockResolvedValueOnce(null);
  await vi.advanceTimersByTimeAsync(1000);
  expect(audio.run()).toBeUndefined();
  expect(audio.error()).toBe("");
});

it("ignores an already submitted discovery result after cancellation", async () => {
  const { audio } = setup();
  let resolve!: (value: unknown) => void;
  request.mockResolvedValueOnce({ capabilities: ["network_audio_upnp"] });
  request.mockImplementationOnce(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  const pending = audio.discover("192.168.1.10");
  await Promise.resolve();
  expect(request).toHaveBeenCalledTimes(2);
  audio.cancelRead();
  resolve({ items: [{ name: "Retired renderer", endpoint: "http://192.168.1.20/device.xml" }] });
  await pending;
  expect(audio.devices()).toEqual([]);
  expect(audio.busy()).toBe(false);
  expect(audio.error()).toBe("");
});

it("does not submit playback after logout during local transport shutdown", async () => {
  const { audio, setSession, beforeStart } = setup();
  await audio.discover("192.168.1.10");
  let release!: () => void;
  beforeStart.mockImplementationOnce(
    () =>
      new Promise<void>((done) => {
        release = done;
      }),
  );
  request.mockClear();
  const pending = audio.start("192.168.1.10", "http://192.168.1.20/device.xml");
  setSession(undefined);
  release();
  await pending;
  expect(request).not.toHaveBeenCalled();
  expect(audio.run()).toBeUndefined();
  expect(audio.busy()).toBe(false);
});

it("stops a late accepted play after cancellation without publishing it", async () => {
  const { audio } = setup();
  await audio.discover("192.168.1.10");
  let resolve!: (value: unknown) => void;
  request.mockImplementationOnce(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  const pending = audio.start("192.168.1.10", "http://192.168.1.20/device.xml");
  await Promise.resolve();
  audio.cancelRead();
  resolve({ id: 7, status: "running" });
  await pending;
  expect(request).toHaveBeenLastCalledWith(
    "/api/admin/v1/network-audio/stop",
    {},
    "POST",
    { id: 7 },
    "server",
    owner,
  );
  expect(audio.run()).toBeUndefined();
  expect(vi.getTimerCount()).toBe(0);
});

it("refuses UPnP commands after the account loses administrator rights", async () => {
  const { audio, setSession, beforeStart } = setup();
  await audio.discover("192.168.1.10");
  setSession({ ...owner, account: { ...owner.account, role: "user" } });
  request.mockClear();
  await audio.discover("192.168.1.10");
  await audio.start("192.168.1.10", "http://192.168.1.20/device.xml");
  await audio.stop();
  expect(audio.enabled()).toBe(false);
  expect(audio.devices()).toEqual([]);
  expect(request).not.toHaveBeenCalled();
  expect(beforeStart).not.toHaveBeenCalled();
});

it("stops a late accepted play after controller disposal", async () => {
  const { audio } = setup();
  await audio.discover("192.168.1.10");
  let resolve!: (value: unknown) => void;
  request.mockImplementationOnce(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  const pending = audio.start("192.168.1.10", "http://192.168.1.20/device.xml");
  await Promise.resolve();
  dispose();
  resolve({ id: 7, status: "running" });
  await pending;
  expect(request).toHaveBeenLastCalledWith(
    "/api/admin/v1/network-audio/stop",
    {},
    "POST",
    { id: 7 },
    "server",
    owner,
  );
  expect(vi.getTimerCount()).toBe(0);
});

async function discoverProfiles(audio: ReturnType<typeof createNetworkAudio>) {
  request.mockResolvedValueOnce({ capabilities: ["network_audio_upnp", "network_audio_profiles"] });
  request.mockResolvedValueOnce({
    items: [
      { name: "OpenHome", endpoint: "http://192.168.1.20/device.xml", protocol: "openhome" },
      { name: "Cast", endpoint: "192.168.1.21:8009", protocol: "googlecast" },
    ],
  });
  await audio.discover("192.168.1.10");
}
it("sends explicit OpenHome replacement only when requested", async () => {
  const { audio } = setup();
  await discoverProfiles(audio);
  await audio.start("192.168.1.10", "openhome:http://192.168.1.20/device.xml", { replace: true });
  expect(request).toHaveBeenLastCalledWith(
    "/api/admin/v1/network-audio/play",
    {},
    "POST",
    {
      bind: "192.168.1.10",
      device: "http://192.168.1.20/device.xml",
      protocol: "openhome",
      replace: true,
      tracks: ["track:one"],
    },
    "server",
    owner,
  );
});
it("Cast requires the current inspected fingerprint before stopping local audio", async () => {
  const { audio, beforeStart } = setup();
  await discoverProfiles(audio);
  const key = "googlecast:192.168.1.21:8009",
    pin = "a".repeat(64);
  await audio.start("192.168.1.10", key, { pin });
  expect(beforeStart).not.toHaveBeenCalled();
  request.mockResolvedValueOnce({ sha256: pin });
  await audio.inspect(key);
  await audio.start("192.168.1.10", key, { pin });
  expect(request).toHaveBeenLastCalledWith(
    "/api/admin/v1/network-audio/play",
    {},
    "POST",
    {
      bind: "192.168.1.10",
      device: "192.168.1.21:8009",
      protocol: "googlecast",
      replace: false,
      certificate_sha256: pin,
      tracks: ["track:one"],
    },
    "server",
    owner,
  );
});
it("late Cast inspection cannot cross logout or cancellation", async () => {
  for (const logout of [true, false]) {
    const { audio, setSession } = setup();
    await discoverProfiles(audio);
    let finish!: (value: unknown) => void;
    request.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const pending = audio.inspect("googlecast:192.168.1.21:8009");
    if (logout) setSession(undefined);
    else audio.cancelRead();
    finish({ sha256: "a".repeat(64) });
    await pending;
    expect(audio.observed()).toBeUndefined();
    dispose();
  }
});
it("adds a literal SlimProto peer without requiring LAN discovery and refuses changed bind", async () => {
  const { audio, beforeStart } = setup();
  request.mockResolvedValueOnce({ capabilities: ["network_audio_profiles"] });
  await audio.addSlimproto("192.168.1.10", "192.168.1.22");
  await audio.start("192.168.1.99", "slimproto:192.168.1.22");
  expect(beforeStart).not.toHaveBeenCalled();
  await audio.start("192.168.1.10", "slimproto:192.168.1.22");
  expect(request).toHaveBeenLastCalledWith(
    "/api/admin/v1/network-audio/play",
    {},
    "POST",
    {
      bind: "192.168.1.10",
      device: "192.168.1.22",
      protocol: "slimproto",
      replace: false,
      tracks: ["track:one"],
    },
    "server",
    owner,
  );
});

it.each([
  ["openhome", "logout"],
  ["openhome", "cancel"],
  ["openhome", "dispose"],
  ["googlecast", "logout"],
  ["googlecast", "cancel"],
  ["googlecast", "dispose"],
  ["slimproto", "logout"],
  ["slimproto", "cancel"],
  ["slimproto", "dispose"],
] as const)(
  "retires late %s playback after %s with the original login",
  async (protocol, transition) => {
    const { audio, setSession } = setup();
    await discoverProfiles(audio);
    let key =
      protocol === "openhome"
        ? "openhome:http://192.168.1.20/device.xml"
        : "googlecast:192.168.1.21:8009";
    const settings: { pin?: string } = {};
    if (protocol === "googlecast") {
      settings.pin = "a".repeat(64);
      request.mockResolvedValueOnce({ sha256: settings.pin });
      await audio.inspect(key);
    }
    if (protocol === "slimproto") {
      request.mockResolvedValueOnce({ capabilities: ["network_audio_profiles"] });
      await audio.addSlimproto("192.168.1.10", "192.168.1.22");
      key = "slimproto:192.168.1.22";
    }
    let finish!: (value: unknown) => void;
    request.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const pending = audio.start("192.168.1.10", key, settings);
    await Promise.resolve();
    const submitted = request.mock.calls.at(-1)!;
    expect(submitted[0]).toBe("/api/admin/v1/network-audio/play");
    expect(submitted[3]).toMatchObject({ protocol });
    if (transition === "logout")
      setSession({ ...owner, account: { ...owner.account, id: "replacement" } });
    else if (transition === "cancel") audio.cancelRead();
    else dispose();
    finish({ id: 7, status: "running" });
    await pending;
    expect(request).toHaveBeenLastCalledWith(
      "/api/admin/v1/network-audio/stop",
      {},
      "POST",
      { id: 7 },
      "server",
      owner,
    );
    expect(audio.run()).toBeUndefined();
    expect(audio.error()).toBe("");
    expect(vi.getTimerCount()).toBe(0);
  },
);

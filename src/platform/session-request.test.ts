import { aedeAvailability } from "../library/aede-availability";
import { afterEach, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import {
  downloadAede,
  restoreAedeSession,
  playbackStart,
  loginAede,
  logoutAede,
  requestAede,
  startLocal,
  stopLocal,
} from "./desktop";
vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn(), isTauri: () => true }));
afterEach(() => {
  vi.resetAllMocks();
  aedeAvailability.owner("server");
  aedeAvailability.owner("local");
});
const owner = (id: string, nativeSession: string) => ({
  server: "https://fixture.example",
  nativeSession,
  account: { id, username: id, role: "user" },
});
it("captures native account tickets before a private invocation can be dispatched after replacement", async () => {
  vi.mocked(invoke).mockResolvedValueOnce(owner("alice", "1"));
  await loginAede("https://fixture.example", "alice", "fictional-password");
  let finish!: (value: unknown) => void;
  vi.mocked(invoke).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const pending = requestAede(
    "/api/me/v1/annotation",
    { ref: "release:fixture" },
    "PUT",
    { note: "Alice draft" },
    "server",
  );
  vi.mocked(invoke).mockResolvedValueOnce(undefined);
  await logoutAede();
  vi.mocked(invoke).mockResolvedValueOnce(owner("bob", "3"));
  await loginAede("https://fixture.example", "bob", "fictional-password");
  const first = vi.mocked(invoke).mock.calls.find(([name]) => name === "aede_request")?.[1];
  expect(first).toMatchObject({
    expectedSession: "1",
    source: "server",
    body: { note: "Alice draft" },
  });
  finish({});
  await pending;
  vi.mocked(invoke).mockResolvedValueOnce({});
  await requestAede("/api/me/v1/preferences", {}, "PATCH", { values: {} }, "server");
  expect(vi.mocked(invoke).mock.calls.at(-1)?.[1]).toMatchObject({ expectedSession: "3" });
});
it("keeps local and server request tickets distinct and removes them before stopping or logout", async () => {
  vi.mocked(invoke).mockResolvedValueOnce(owner("server", "5"));
  await loginAede("https://fixture.example", "server", "fictional-password");
  vi.mocked(invoke).mockResolvedValueOnce(owner("managed", "7"));
  await startLocal();
  vi.mocked(invoke).mockResolvedValue({});
  await requestAede(
    "/api/me/v1/annotation",
    { ref: "track:@phemios/local/fixture" },
    "PUT",
    { loved: true },
    "server",
  );
  expect(vi.mocked(invoke).mock.calls.at(-1)?.[1]).toMatchObject({
    source: "local",
    expectedSession: "7",
  });
  await stopLocal();
  await requestAede("/api/v1/status", {}, "GET", null, "server");
  expect(vi.mocked(invoke).mock.calls.at(-1)?.[1]).toMatchObject({ expectedSession: "5" });
  await logoutAede();
  await requestAede("/api/v1/status", {}, "GET", null, "server");
  expect(vi.mocked(invoke).mock.calls.at(-1)?.[1]).not.toHaveProperty("expectedSession");
});

it("keeps an explicitly captured private reader ticket after native replacement instead of substituting the latest owner", async () => {
  const alice = owner("alice", "11");
  vi.mocked(invoke).mockResolvedValueOnce(alice);
  await loginAede("https://fixture.example", "alice", "fixture");
  vi.mocked(invoke).mockResolvedValueOnce(owner("bob", "13"));
  await loginAede("https://fixture.example", "bob", "fixture");
  vi.mocked(invoke).mockResolvedValue({});
  await requestAede(
    "/api/me/v1/preferences",
    {},
    "GET",
    null,
    "server",
    alice as import("../library/server").AccountSession,
  );
  expect(vi.mocked(invoke).mock.calls.at(-1)?.[1]).toMatchObject({ expectedSession: "11" });
  await requestAede("/api/me/v1/preferences", {}, "GET", null, "server", {
    server: alice.server,
    account: alice.account,
  });
  expect(vi.mocked(invoke).mock.calls.at(-1)?.[1]).not.toHaveProperty("expectedSession");
});

it("captures the source ticket for private exports and history-owning playback starts", async () => {
  vi.mocked(invoke).mockResolvedValueOnce(owner("server", "21"));
  await loginAede("https://fixture.example", "server", "fixture");
  vi.mocked(invoke).mockResolvedValueOnce(owner("managed", "23"));
  await startLocal();
  vi.mocked(invoke).mockResolvedValue({});
  await downloadAede("m3u-fixture", "server");
  expect(vi.mocked(invoke).mock.calls.at(-1)?.[1]).toMatchObject({
    expectedSession: "21",
    source: "server",
  });
});
it("captures the original owner of history before playback native admission", async () => {
  vi.mocked(invoke).mockResolvedValueOnce(owner("server", "21"));
  await loginAede("https://fixture.example", "server", "fixture");
  vi.mocked(invoke).mockResolvedValueOnce(owner("managed", "23"));
  await startLocal();
  vi.mocked(invoke).mockResolvedValue({});
  await playbackStart(["track:@phemios/local/fixture"], "device", 0);
  expect(vi.mocked(invoke).mock.calls.at(-1)?.[1]).toMatchObject({ expectedSession: "23" });
  await playbackStart(["track:server-fixture"], "device", 0);
  expect(vi.mocked(invoke).mock.calls.at(-1)?.[1]).toMatchObject({ expectedSession: "21" });
});

it("publishes a transport outage immediately, recovers on a successful request and clears it before logout", async () => {
  vi.mocked(invoke).mockResolvedValueOnce(owner("alice", "31"));
  await loginAede("https://fixture.example", "alice", "fixture");
  vi.mocked(invoke).mockRejectedValueOnce("Impossible de joindre Aède.");
  await expect(requestAede("/api/me/v1/collections")).rejects.toThrow(
    "Impossible de joindre Aède.",
  );
  expect(aedeAvailability.unavailable()).toEqual(["server"]);
  vi.mocked(invoke).mockResolvedValueOnce({});
  await requestAede("/api/v1/library");
  expect(aedeAvailability.unavailable()).toEqual([]);
  vi.mocked(invoke).mockRejectedValueOnce("Impossible de joindre Aède.");
  await expect(requestAede("/api/v1/library")).rejects.toThrow();
  vi.mocked(invoke).mockResolvedValueOnce(undefined);
  await logoutAede();
  expect(aedeAvailability.unavailable()).toEqual([]);
});
it("does not attach a failed old request to a replacement login", async () => {
  vi.mocked(invoke).mockResolvedValueOnce(owner("alice", "41"));
  await loginAede("https://fixture.example", "alice", "fixture");
  let fail!: (reason: string) => void;
  vi.mocked(invoke).mockImplementationOnce(
    () =>
      new Promise((_resolve, reject) => {
        fail = reject;
      }),
  );
  const pending = requestAede("/api/me/v1/collections");
  vi.mocked(invoke).mockResolvedValueOnce(owner("bob", "43"));
  await loginAede("https://fixture.example", "bob", "fixture");
  fail("Impossible de joindre Aède.");
  await expect(pending).rejects.toThrow();
  expect(aedeAvailability.unavailable()).toEqual([]);
});

const nativeRuntime = {
  bridgeVersion: 1,
  name: "Phémios",
  version: "0.1.0",
  native: true,
  capabilities: ["native_session_read"],
};
it("restores the process-owned session after an interface reload without creating another remote login", async () => {
  vi.mocked(invoke)
    .mockResolvedValueOnce(nativeRuntime)
    .mockResolvedValueOnce(owner("alice", "71"));
  expect(await restoreAedeSession("server")).toEqual(owner("alice", "71"));
  vi.mocked(invoke).mockResolvedValueOnce({});
  await requestAede("/api/me/v1/preferences", {}, "GET", null, "server");
  expect(vi.mocked(invoke).mock.calls.at(-1)?.[1]).toMatchObject({ expectedSession: "71" });
  expect(vi.mocked(invoke).mock.calls.some(([name]) => name === "aede_login")).toBe(false);
});
it("does not restore a session read that finishes after logout", async () => {
  let resolve!: (value: unknown) => void;
  vi.mocked(invoke)
    .mockResolvedValueOnce(nativeRuntime)
    .mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
  const restored = restoreAedeSession("server");
  for (let i = 0; i < 8; i++) await Promise.resolve();
  vi.mocked(invoke).mockResolvedValueOnce(undefined);
  await logoutAede();
  resolve(owner("alice", "81"));
  expect(await restored).toBeUndefined();
  vi.mocked(invoke).mockResolvedValueOnce({});
  await requestAede("/api/v1/status", {}, "GET", null, "server");
  expect(vi.mocked(invoke).mock.calls.at(-1)?.[1]).not.toHaveProperty("expectedSession");
});
it("keeps a replacement login's ticket when an old restoration reply arrives", async () => {
  let resolve!: (value: unknown) => void;
  vi.mocked(invoke)
    .mockResolvedValueOnce(nativeRuntime)
    .mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
  const restored = restoreAedeSession("server");
  for (let i = 0; i < 8; i++) await Promise.resolve();
  vi.mocked(invoke).mockResolvedValueOnce(owner("bob", "93"));
  await loginAede("https://fixture.example", "bob", "fixture");
  resolve(owner("alice", "91"));
  expect(await restored).toBeUndefined();
  vi.mocked(invoke).mockResolvedValueOnce({});
  await requestAede("/api/me/v1/preferences", {}, "GET", null, "server");
  expect(vi.mocked(invoke).mock.calls.at(-1)?.[1]).toMatchObject({ expectedSession: "93" });
});
it("does not query an unsupported session command on an older native host", async () => {
  vi.mocked(invoke).mockResolvedValueOnce({ ...nativeRuntime, capabilities: [] });
  expect(await restoreAedeSession("server")).toBeUndefined();
  expect(vi.mocked(invoke).mock.calls.map(([name]) => name)).toEqual(["runtime_info"]);
});

it("does not reinstall a login reply delivered after logout", async () => {
  let resolve!: (value: unknown) => void;
  vi.mocked(invoke).mockImplementationOnce(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  const login = loginAede("https://fixture.example", "alice", "fixture");
  vi.mocked(invoke).mockResolvedValueOnce(undefined);
  await logoutAede();
  resolve(owner("alice", "101"));
  await expect(login).rejects.toThrow(/Session/);
  vi.mocked(invoke).mockResolvedValueOnce({});
  await requestAede("/api/v1/status", {}, "GET", null, "server");
  expect(vi.mocked(invoke).mock.calls.at(-1)?.[1]).not.toHaveProperty("expectedSession");
});
it("does not reinstall a local-start reply delivered after stopping the local engine", async () => {
  let resolve!: (value: unknown) => void;
  vi.mocked(invoke).mockImplementationOnce(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  const start = startLocal();
  vi.mocked(invoke).mockResolvedValueOnce(undefined);
  await stopLocal();
  resolve(owner("managed", "111"));
  await expect(start).rejects.toThrow(/Session/);
  vi.mocked(invoke).mockResolvedValueOnce({});
  await requestAede("/api/v1/status", {}, "GET", null, "local");
  expect(vi.mocked(invoke).mock.calls.at(-1)?.[1]).not.toHaveProperty("expectedSession");
});

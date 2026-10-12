import { afterEach, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import {
  downloadAede,
  playbackStart,
  loginAede,
  logoutAede,
  requestAede,
  startLocal,
  stopLocal,
} from "./desktop";
vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn(), isTauri: () => true }));
afterEach(() => vi.resetAllMocks());
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

import { createRoot, createSignal } from "solid-js";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { requestAede } from "../platform/desktop";
import { announceSetting, createSavedSettings, parseAccountSettings } from "./saved-settings";
import type { AccountSession } from "./server";
vi.mock("../platform/desktop", () => ({ requestAede: vi.fn() }));
let values: Map<string, string>;
beforeEach(() => {
  vi.resetAllMocks();
  values = new Map();
  vi.stubGlobal("window", new EventTarget());
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  });
  vi.stubGlobal("document", { documentElement: { style: { setProperty: vi.fn() }, lang: "fr" } });
});
afterEach(() => vi.unstubAllGlobals());
const account = (id: string): AccountSession => ({
  server: "http://127.0.0.1:3412",
  account: { id, username: id, role: "user" },
});
const settle = async () => {
  for (let index = 0; index < 12; index++) await Promise.resolve();
};
it("refuses malformed account settings and excludes credentials from the projection", () => {
  expect(
    parseAccountSettings({ values: { "phemios.duration": true, password: "excluded" } }),
  ).toEqual({ "phemios.duration": true });
  expect(() => parseAccountSettings({ values: { "phemios.duration": "remaining" } })).toThrow();
  expect(() => parseAccountSettings({ values: { "phemios.visualizer": "unknown" } })).toThrow();
});
it("ignores a late response from a replaced account and preserves corrupt device stores", async () => {
  let finish!: (value: unknown) => void;
  vi.mocked(requestAede).mockImplementation(async (path) =>
    path === "/api/v1/status"
      ? { capabilities: ["account_preferences"] }
      : new Promise((resolve) => {
          finish = resolve;
        }),
  );
  let dispose!: () => void;
  const [session, setSession] = createSignal<AccountSession | undefined>(account("one"));
  let settings!: ReturnType<typeof createSavedSettings>;
  createRoot((cleanup) => {
    dispose = cleanup;
    settings = createSavedSettings(session, () => "server");
  });
  await settle();
  const originalFinish = finish;
  setSession(undefined);
  originalFinish({ values: { "phemios.duration": true } });
  await settle();
  expect(values.size).toBe(0);
  values.set("phemios.appearance", "broken json");
  setSession(account("two"));
  await settle();
  finish({ values: { "phemios.duration": false } });
  await settle();
  expect(values.get("phemios.appearance")).toBe("broken json");
  expect(values.has("phemios.duration")).toBe(false);
  expect(settings.error()).not.toBe("");
  dispose();
});
it("serializes independent preference writes and never sends queued changes to a replacement account", async () => {
  let release!: () => void;
  vi.mocked(requestAede).mockImplementation(async (path, _query, method) => {
    if (path === "/api/v1/status") return { capabilities: ["account_preferences"] };
    if (method === "GET") return { values: { "phemios.duration": false } };
    return new Promise<void>((resolve) => {
      release = resolve;
    });
  });
  let dispose!: () => void;
  const [session, setSession] = createSignal<AccountSession | undefined>(account("one"));
  createRoot((cleanup) => {
    dispose = cleanup;
    createSavedSettings(session, () => "server");
  });
  await settle();
  announceSetting("phemios.duration", "true");
  announceSetting("phemios.visualizer", '"waves"');
  await settle();
  const patches = () => vi.mocked(requestAede).mock.calls.filter((call) => call[2] === "PATCH");
  expect(patches()).toHaveLength(1);
  expect(patches()[0]?.[3]).toEqual({ values: { "phemios.duration": true } });
  setSession(account("two"));
  release();
  await settle();
  expect(patches()).toHaveLength(1);
  dispose();
});

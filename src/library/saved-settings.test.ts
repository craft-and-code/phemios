import { createRoot, createSignal } from "solid-js";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { requestAede } from "../platform/desktop";
import { announceSetting, createSavedSettings, parseAccountSettings } from "./saved-settings";
import type { AccountSession } from "./server";
import {
  interfacePreferences,
  accountPreferenceOwner,
  createAccountPreferenceProfiles,
} from "./account-preferences";
import {
  defaultToolPreferences,
  saveToolPreferences,
  readToolPreferences,
} from "./tool-preferences";
import { readPreferences, defaultPreferences } from "./preferences";
vi.mock("../platform/desktop", () => ({ requestAede: vi.fn() }));
let values: Map<string, string>;
beforeEach(() => {
  vi.resetAllMocks();
  values = new Map();
  vi.stubGlobal("window", new EventTarget());
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  });
  vi.stubGlobal("document", { documentElement: { style: { setProperty: vi.fn() }, lang: "fr" } });
});
afterEach(() => vi.unstubAllGlobals());
const account = (id: string): AccountSession => ({
  server: "http://127.0.0.1:3412",
  nativeSession: `session-${id}`,
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
  expect(settings.error()).toBe("");
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
  const original = account("one"),
    [session, setSession] = createSignal<AccountSession | undefined>(original);
  createRoot((cleanup) => {
    dispose = cleanup;
    createSavedSettings(session, () => "server");
  });
  await settle();
  expect(
    vi
      .mocked(requestAede)
      .mock.calls.slice(0, 2)
      .map((call) => call[5]),
  ).toEqual([original, original]);
  announceSetting("phemios.duration", "true");
  announceSetting("phemios.visualizer", '"waves"');
  await settle();
  const patches = () => vi.mocked(requestAede).mock.calls.filter((call) => call[2] === "PATCH");
  expect(patches()).toHaveLength(1);
  expect(patches()[0]?.[3]).toEqual({ values: { "phemios.duration": true } });
  expect(patches()[0]?.[5]).toBe(original);
  setSession(account("two"));
  release();
  await settle();
  expect(patches()).toHaveLength(1);
  dispose();
});

it("retains disabled and floating scenes and terminal bars through owner preferences", () => {
  for (const scene of ["off", "floating"])
    expect(
      parseAccountSettings({
        values: { "phemios.visualizer": scene, "phemios.spectrum-style": "terminal" },
      }),
    ).toEqual({ "phemios.visualizer": scene, "phemios.spectrum-style": "terminal" });
  expect(() => parseAccountSettings({ values: { "phemios.spectrum-style": "random" } })).toThrow();
});

it("rolls back every account preference when a device write fails during hydration", async () => {
  values.set("phemios.duration", "true");
  values.set("phemios.visualizer", '"floating"');
  values.set("private-data", "untouched");
  const owner = account("one");
  const scoped = createAccountPreferenceProfiles(localStorage);
  scoped.activate(accountPreferenceOwner(owner, "server"));
  scoped.storage.setItem("phemios.duration", "true");
  scoped.storage.setItem("phemios.visualizer", '"floating"');
  const previous = [...values];
  let fail = true;
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      if (key.startsWith("phemios.interface-profile.v1:") && fail) {
        fail = false;
        throw new Error("No space");
      }
      values.set(key, value);
    },
    removeItem: (key: string) => values.delete(key),
  });
  vi.mocked(requestAede).mockImplementation(async (path) =>
    path === "/api/v1/status"
      ? { capabilities: ["account_preferences"] }
      : { values: { "phemios.duration": false, "phemios.visualizer": "waves" } },
  );
  let dispose!: () => void;
  let settings!: ReturnType<typeof createSavedSettings>;
  createRoot((cleanup) => {
    dispose = cleanup;
    settings = createSavedSettings(
      () => owner,
      () => "server",
    );
  });
  await settle();
  expect([...values]).toEqual(previous);
  expect(settings.error()).toContain("No space");
  dispose();
});
it("refuses to overwrite an unreadable audio preference store on login", async () => {
  values.set("phemios.audio.v1", "broken legacy json");
  const owner = account("one");
  const scoped = createAccountPreferenceProfiles(localStorage);
  scoped.activate(accountPreferenceOwner(owner, "server"));
  scoped.storage.setItem("phemios.audio.v1", '"broken json"');
  const original = [...values];
  vi.mocked(requestAede).mockImplementation(async (path) =>
    path === "/api/v1/status"
      ? { capabilities: ["account_preferences"] }
      : {
          values: {
            "phemios.audio.v1": { crossfadeMs: 0, repeat: "off", policy: "without-effects" },
          },
        },
  );
  let dispose!: () => void;
  let settings!: ReturnType<typeof createSavedSettings>;
  createRoot((cleanup) => {
    dispose = cleanup;
    settings = createSavedSettings(
      () => owner,
      () => "server",
    );
  });
  await settle();
  expect([...values]).toEqual(original);
  expect(values.has("phemios.duration")).toBe(false);
  expect(settings.error()).not.toBe("");
  dispose();
});

it("preserves edits made during account loading and then synchronizes their final value", async () => {
  let finish!: (value: unknown) => void;
  vi.mocked(requestAede).mockImplementation(async (path, _query, method) => {
    if (path === "/api/v1/status") return { capabilities: ["account_preferences"] };
    if (method === "GET")
      return new Promise((resolve) => {
        finish = resolve;
      });
    return undefined;
  });
  const owner = account("one");
  let dispose!: () => void;
  let settings!: ReturnType<typeof createSavedSettings>;
  createRoot((cleanup) => {
    dispose = cleanup;
    settings = createSavedSettings(
      () => owner,
      () => "server",
    );
  });
  await settle();
  interfacePreferences.setItem("phemios.visualizer", '"waves"');
  announceSetting("phemios.visualizer", '"waves"');
  interfacePreferences.setItem("phemios.visualizer", '"floating"');
  announceSetting("phemios.visualizer", '"floating"');
  finish({ values: { "phemios.visualizer": "sphere", "phemios.duration": true } });
  await settle();
  expect(interfacePreferences.getItem("phemios.visualizer")).toBe('"floating"');
  expect(interfacePreferences.getItem("phemios.duration")).toBe("true");
  const patches = vi.mocked(requestAede).mock.calls.filter((call) => call[2] === "PATCH");
  expect(patches).toHaveLength(1);
  expect(patches[0]?.[3]).toEqual({ values: { "phemios.visualizer": "floating" } });
  expect(settings.error()).toBe("");
  dispose();
});

it("does not expose Alice's interface profile to logout or Bob's partial preferences", async () => {
  const alice = { ...defaultPreferences, language: "en" as const, background: "#222222" };
  const [session, setSession] = createSignal<AccountSession | undefined>(account("alice"));
  vi.mocked(requestAede).mockImplementation(async (path) =>
    path === "/api/v1/status"
      ? { capabilities: ["account_preferences"] }
      : {
          values:
            session()?.account.id === "alice"
              ? { "phemios.appearance": alice }
              : { "phemios.duration": true },
        },
  );
  let dispose!: () => void;
  createRoot((cleanup) => {
    dispose = cleanup;
    createSavedSettings(session, () => "server");
  });
  try {
    await settle();
    expect(readPreferences(interfacePreferences).background).toBe("#222222");
    setSession(undefined);
    expect(readPreferences(interfacePreferences)).toEqual(defaultPreferences);
    setSession(account("bob"));
    await settle();
    expect(readPreferences(interfacePreferences)).toEqual(defaultPreferences);
    const bob = { ...readPreferences(interfacePreferences), language: "en" as const };
    interfacePreferences.setItem("phemios.appearance", JSON.stringify(bob));
    announceSetting("phemios.appearance", JSON.stringify(bob));
    await settle();
    const patches = vi.mocked(requestAede).mock.calls.filter((call) => call[2] === "PATCH");
    expect(patches[0]?.[3]).toEqual({ values: { "phemios.appearance": bob } });
    expect(bob.background).toBe(defaultPreferences.background);
    setSession(account("alice"));
    await settle();
    expect(readPreferences(interfacePreferences)).toEqual(alice);
    expect(values.has("phemios.appearance")).toBe(false);
  } finally {
    dispose();
  }
});

it("synchronizes cover sizes to the captured Aède account and restores them in the interface projection", async () => {
  const session = account("cover-owner");
  const stored = { ...defaultToolPreferences, coverSize: 180, coverSizes: { albums: 220 } };
  vi.mocked(requestAede).mockImplementation(async (path, _query, method) =>
    path.endsWith("status")
      ? { capabilities: ["account_preferences"] }
      : method === "PATCH"
        ? {}
        : { values: { "phemios.tools.v1": stored } },
  );
  let dispose!: () => void;
  createRoot((cleanup) => {
    dispose = cleanup;
    createSavedSettings(
      () => session,
      () => "server",
    );
  });
  await settle();
  expect(readToolPreferences(interfacePreferences)).toMatchObject({
    coverSize: 180,
    coverSizes: { albums: 220 },
  });
  saveToolPreferences(interfacePreferences, { coverSizes: { albums: 240 } });
  await settle();
  expect(requestAede).toHaveBeenCalledWith(
    "/api/me/v1/preferences",
    {},
    "PATCH",
    { values: { "phemios.tools.v1": { ...stored, coverSizes: { albums: 240 } } } },
    "server",
    session,
  );
  dispose();
});

it.each(["account", "relogin", "source"] as const)(
  "does not let an unresolved retired preference patch block the current %s scope",
  async (change) => {
    const original = account("one");
    const [session, setSession] = createSignal<AccountSession | undefined>(original);
    const [source, setSource] = createSignal<"server" | "local">("server");
    const completions: (() => void)[] = [];
    vi.mocked(requestAede).mockImplementation(async (path, _query, method) => {
      if (path === "/api/v1/status") return { capabilities: ["account_preferences"] };
      if (method === "GET") return { values: {} };
      return new Promise<void>((resolve) => completions.push(resolve));
    });
    let dispose!: () => void;
    const settings = createRoot((cleanup) => {
      dispose = cleanup;
      return createSavedSettings(session, source);
    });
    const patches = () => vi.mocked(requestAede).mock.calls.filter((call) => call[2] === "PATCH");
    try {
      await settle();
      announceSetting("phemios.duration", "true");
      announceSetting("phemios.visualizer", '"waves"');
      await settle();
      expect(patches()).toHaveLength(1);
      if (change === "source") setSource("local");
      else
        setSession(
          change === "relogin" ? { ...original, nativeSession: "second-login" } : account("two"),
        );
      await settle();
      announceSetting("phemios.duration", "false");
      await settle();
      expect(patches()).toHaveLength(2);
      expect(patches()[1]?.[4]).toBe(source());
      expect(patches()[1]?.[5]).toBe(session());
      completions[0]?.();
      await settle();
      expect(patches()).toHaveLength(2);
      expect(settings.status()).toContain("Enregistrement");
      completions[1]?.();
      await settle();
      expect(settings.error()).toBe("");
      expect(settings.status()).toContain("Enregistré");
    } finally {
      dispose();
      completions.forEach((complete) => complete());
      await settle();
    }
  },
);

it("keeps patches for the active preference profile ordered", async () => {
  const completions: (() => void)[] = [];
  vi.mocked(requestAede).mockImplementation(async (path, _query, method) => {
    if (path === "/api/v1/status") return { capabilities: ["account_preferences"] };
    if (method === "GET") return { values: {} };
    return new Promise<void>((resolve) => completions.push(resolve));
  });
  const original = account("one");
  let dispose!: () => void;
  createRoot((cleanup) => {
    dispose = cleanup;
    createSavedSettings(
      () => original,
      () => "server",
    );
  });
  const patches = () => vi.mocked(requestAede).mock.calls.filter((call) => call[2] === "PATCH");
  try {
    await settle();
    announceSetting("phemios.duration", "true");
    announceSetting("phemios.duration", "false");
    await settle();
    expect(patches()).toHaveLength(1);
    completions[0]?.();
    await settle();
    expect(patches()).toHaveLength(2);
    expect(patches().map((call) => call[3])).toEqual([
      { values: { "phemios.duration": true } },
      { values: { "phemios.duration": false } },
    ]);
    completions[1]?.();
    await settle();
  } finally {
    dispose();
    completions.forEach((complete) => complete());
    await settle();
  }
});

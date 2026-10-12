import { expect, it } from "vitest";
import { createAccountPreferenceProfiles, accountPreferenceOwner } from "./account-preferences";
import { parseAccountSettings } from "./saved-settings";
import { defaultPreferences, readPreferences } from "./preferences";
const checked = (values: Record<string, unknown>) => parseAccountSettings({ values });
function fixture() {
  const data = new Map<string, string>();
  const storage = {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
  };
  return { data, storage };
}
it("preserves global legacy bytes and anonymous choices without attributing either to a new account", () => {
  const fixtureData = fixture();
  fixtureData.data.set(
    "phemios.appearance",
    JSON.stringify({ ...defaultPreferences, background: "#666666" }),
  );
  const profile = createAccountPreferenceProfiles(fixtureData.storage);
  expect(readPreferences(profile.storage)).toEqual(defaultPreferences);
  profile.storage.setItem(
    "phemios.appearance",
    JSON.stringify({ ...defaultPreferences, background: "#333333" }),
  );
  profile.activate("alice", checked);
  expect(readPreferences(profile.storage)).toEqual(defaultPreferences);
  profile.storage.setItem(
    "phemios.appearance",
    JSON.stringify({ ...defaultPreferences, background: "#222222" }),
  );
  profile.activate("bob", checked);
  expect(readPreferences(profile.storage)).toEqual(defaultPreferences);
  profile.activate(undefined, checked);
  expect(readPreferences(profile.storage).background).toBe("#333333");
  const boot = createAccountPreferenceProfiles(fixtureData.storage);
  expect(readPreferences(boot.storage).background).toBe("#333333");
  expect(fixtureData.data.get("phemios.appearance")).toContain("#666666");
  profile.activate("alice", checked);
  expect(readPreferences(profile.storage).background).toBe("#222222");
});
it("rejects old generation hydration even after returning to the same owner and resets absent fields", () => {
  const { storage } = fixture(),
    profile = createAccountPreferenceProfiles(storage);
  profile.activate("alice", checked);
  const old = profile.identity();
  profile.storage.setItem("phemios.visualizer", '"floating"');
  profile.activate("bob", checked);
  profile.activate("alice", checked);
  expect(profile.replace(old, { "phemios.visualizer": "waves" })).toBe(false);
  expect(profile.storage.getItem("phemios.visualizer")).toBe('"floating"');
  expect(profile.replace(profile.identity(), { "phemios.duration": true })).toBe(true);
  expect(profile.storage.getItem("phemios.visualizer")).toBeNull();
  expect(profile.storage.getItem("phemios.duration")).toBe("true");
});
it("keeps a corrupt owner's private bytes while exposing neutral values and refusing implicit writes", () => {
  const { storage, data } = fixture(),
    profile = createAccountPreferenceProfiles(storage);
  profile.activate("alice", checked);
  profile.storage.setItem("phemios.duration", "true");
  const path = [...data.keys()][0]!;
  const malformed = JSON.stringify({ version: 1, values: { "phemios.audio.v1": "bad" } });
  data.set(path, malformed);
  expect(() => profile.activate("alice", checked)).toThrow();
  expect(profile.storage.getItem("phemios.duration")).toBeNull();
  expect(() => profile.storage.setItem("phemios.duration", "false")).toThrow();
  expect(data.get(path)).toBe(malformed);
  profile.activate("bob", checked);
  profile.storage.setItem("phemios.duration", "false");
  expect(data.get(path)).toBe(malformed);
});
it("distinguishes account/source/authority and retains managed-local identity across port changes", () => {
  const alice = {
    server: "https://music.example",
    account: { id: "alice", username: "shared", role: "user" },
  };
  const owner = accountPreferenceOwner(alice, "server");
  expect(
    accountPreferenceOwner({ ...alice, account: { ...alice.account, id: "bob" } }, "server"),
  ).not.toBe(owner);
  expect(accountPreferenceOwner({ ...alice, server: "https://other.example" }, "server")).not.toBe(
    owner,
  );
  expect(accountPreferenceOwner(alice, "local")).not.toBe(owner);
  expect(accountPreferenceOwner({ ...alice, server: "http://127.0.0.1:1234" }, "local")).toBe(
    accountPreferenceOwner({ ...alice, server: "http://127.0.0.1:5678" }, "local"),
  );
});

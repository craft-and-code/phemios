import { saveToolPreferences, readToolPreferences } from "./tool-preferences";
import { expect, it } from "vitest";
import {
  exportPreferenceBackup,
  parsePreferenceBackup,
  applyPreferenceBackup,
} from "./preference-backup";
import { defaultMenuOrder } from "../navigation/menu-preferences";
function store() {
  const values = new Map<string, string>();
  return {
    values,
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
    removeItem: (key: string) => {
      values.delete(key);
    },
  };
}
it("round-trips renamed menus, hidden order, shortcuts and language without native credentials", () => {
  const from = store(),
    to = store();
  from.setItem(
    "phemios.navigation.v1",
    JSON.stringify({
      version: 5,
      order: defaultMenuOrder(),
      hidden: ["radio"],
      labels: { doctor: "Mon diagnostic" },
    }),
  );
  from.setItem("private-key", "not portable");
  const raw = exportPreferenceBackup(from);
  expect(raw).not.toContain("not portable");
  const values = parsePreferenceBackup(raw);
  applyPreferenceBackup(to, values);
  expect(to.getItem("phemios.navigation.v1")).toBe(from.getItem("phemios.navigation.v1"));
  expect(to.getItem("phemios.shortcuts.v1")).toContain("Space");
  expect(to.getItem("phemios.appearance")).toContain('"language":"fr"');
});
it("rejects unknown versions, unknown keys, invalid options and nested secrets before mutation", () => {
  const valid = JSON.parse(exportPreferenceBackup(store()));
  for (const change of [
    { ...valid, version: 2 },
    { ...valid, values: { ...valid.values, apiKey: "excluded" } },
    { ...valid, values: { ...valid.values, "phemios.duration": "no" } },
    {
      ...valid,
      values: {
        ...valid.values,
        "phemios.audio.v1": { ...valid.values["phemios.audio.v1"], secret: "excluded" },
      },
    },
  ])
    expect(() => parsePreferenceBackup(JSON.stringify(change))).toThrow();
});
it("restores earlier values if one write fails and keeps unrelated data intact", () => {
  const destination = store();
  destination.setItem("phemios.duration", "true");
  destination.setItem("personal-data", "untouched");
  const previous = [...destination.values];
  let fail = true;
  const target = {
    ...destination,
    setItem: (key: string, raw: string) => {
      if (key === "phemios.tools.v1" && fail) {
        fail = false;
        throw new Error("No space");
      }
      destination.setItem(key, raw);
    },
  };
  expect(() =>
    applyPreferenceBackup(target, parsePreferenceBackup(exportPreferenceBackup(store()))),
  ).toThrow("No space");
  expect([...destination.values]).toEqual(previous);
});

it("round-trips default and per-view cover sizes in the account-safe backup", () => {
  const from = store(),
    to = store();
  saveToolPreferences(from, { coverSize: 180, coverSizes: { albums: 240, genres: 120 } });
  applyPreferenceBackup(to, parsePreferenceBackup(exportPreferenceBackup(from)));
  expect(readToolPreferences(to)).toMatchObject({
    coverSize: 180,
    coverSizes: { albums: 240, genres: 120 },
  });
});

it("includes the saved volume in portable preferences and accepts older backups without it", () => {
  const storage = store();
  storage.setItem(
    "phemios.audio.v1",
    JSON.stringify({ crossfadeMs: 0, repeat: "off", policy: "without-effects", volume: 0.18 }),
  );
  const backup = JSON.parse(exportPreferenceBackup(storage));
  expect(parsePreferenceBackup(JSON.stringify(backup))["phemios.audio.v1"]).toMatchObject({
    volume: 0.18,
  });
  delete backup.values["phemios.audio.v1"].volume;
  expect(() => parsePreferenceBackup(JSON.stringify(backup))).not.toThrow();
});

it("imports pre-awake backups and preserves an explicitly disabled screen preference", () => {
  const store = { getItem: () => null },
    current = JSON.parse(exportPreferenceBackup(store));
  expect(current.values["phemios.keep-awake"]).toBe(true);
  current.values["phemios.keep-awake"] = false;
  expect(parsePreferenceBackup(JSON.stringify(current))["phemios.keep-awake"]).toBe(false);
  delete current.values["phemios.keep-awake"];
  expect(parsePreferenceBackup(JSON.stringify(current))["phemios.keep-awake"]).toBe(true);
  current.values["phemios.keep-awake"] = "bad";
  expect(() => parsePreferenceBackup(JSON.stringify(current))).toThrow();
});

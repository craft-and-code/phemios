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

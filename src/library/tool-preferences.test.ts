import { expect, it } from "vitest";
import {
  createToolPreferences,
  readToolPreferences,
  saveToolPreferences,
} from "./tool-preferences";
const store = () => {
  let held: string | null = null;
  return {
    getItem: () => held,
    setItem: (_key: string, value: string) => {
      held = value;
    },
  };
};
it("retains scan and enrichment options together with the chosen track display size", () => {
  const storage = store();
  saveToolPreferences(storage, { full: true, threads: 8 });
  saveToolPreferences(storage, { lyrics: true, excluded: ["server"], trackPageSize: 100 });
  expect(readToolPreferences(storage)).toMatchObject({
    full: true,
    threads: 8,
    lyrics: true,
    excluded: ["server"],
    trackPageSize: 100,
  });
});
it("preserves corrupt stores and refuses invalid choices instead of overwriting them", () => {
  const storage = store();
  storage.setItem("", "bad");
  expect(() => saveToolPreferences(storage, { full: true })).toThrow();
  expect(storage.getItem()).toBe("bad");
  for (const patch of [{ threads: -1 }, { trackPageSize: 10000 }, { threads: 2.5 }])
    expect(() => saveToolPreferences(store(), patch)).toThrow();
});
it("does not change the selected setting when saving fails", () => {
  const prefs = createToolPreferences({
    getItem: () => null,
    setItem: () => {
      throw new Error("Disk full");
    },
  });
  prefs.update({ trackPageSize: 100 });
  expect(prefs.value().trackPageSize).toBe(50);
  expect(prefs.error()).toContain("Disk full");
});

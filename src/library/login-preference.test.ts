import { expect, it } from "vitest";
import { readLoginPreference, saveLoginPreference } from "./login-preference";
const storage = () => {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
    values,
  };
};
it("remembers only the successful server and username across reopened forms", () => {
  const store = storage();
  saveLoginPreference(store, "http://127.0.0.1:3413", "listener");
  expect(readLoginPreference(store)).toEqual({
    server: "http://127.0.0.1:3413",
    username: "listener",
  });
  expect([...store.values.values()].join("")).not.toMatch(/password|token/);
});
it("preserves unreadable preferences and reports storage failures", () => {
  const store = storage();
  store.setItem("phemios.login.v1", "{broken");
  expect(() => readLoginPreference(store)).toThrow();
  expect(() => saveLoginPreference(store, "http://localhost:3413", "new")).toThrow();
  expect([...store.values.values()]).toEqual(["{broken"]);
  expect(() =>
    saveLoginPreference(
      {
        getItem: () => null,
        setItem: () => {
          throw new Error("full");
        },
      },
      "http://localhost:3413",
      "listener",
    ),
  ).toThrow();
});
it("refuses secret-bearing or malformed preference records", () => {
  const store = storage();
  store.setItem(
    "phemios.login.v1",
    JSON.stringify({
      version: 1,
      server: "http://localhost:3413",
      username: "listener",
      token: "secret",
    }),
  );
  expect(() => readLoginPreference(store)).toThrow();
  expect(() =>
    saveLoginPreference(storage(), "http://user:secret@localhost:3413", "listener"),
  ).toThrow();
});

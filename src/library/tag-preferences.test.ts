import { expect, it } from "vitest";
import { readTagPreferences, setTagExcluded, suggestionVocabulary } from "./tag-preferences";
import type { AccountSession } from "./server";
const session: AccountSession = {
  server: "https://music.example",
  account: { id: "one", username: "Listener", role: "user" },
};
function store() {
  let raw: string | null = null;
  return {
    getItem: () => raw,
    setItem: (_key: string, value: string) => {
      raw = value;
    },
  };
}
it("removes autocomplete suggestions without removing existing tags, isolated by account and server", () => {
  const storage = store();
  setTagExcluded(storage, session, "Músic", true);
  expect(suggestionVocabulary(["music", "singer"], readTagPreferences(storage), session)).toEqual([
    "singer",
  ]);
  expect(
    suggestionVocabulary(["music"], readTagPreferences(storage), {
      ...session,
      server: "https://other.example",
    }),
  ).toEqual(["music"]);
  expect(
    suggestionVocabulary(["music"], readTagPreferences(storage), {
      ...session,
      account: { ...session.account, id: "two" },
    }),
  ).toEqual(["music"]);
  setTagExcluded(storage, session, "music", false);
  expect(suggestionVocabulary(["music"], readTagPreferences(storage), session)).toEqual(["music"]);
});
it("preserves corrupt preferences and reports refused writes", () => {
  expect(() => readTagPreferences({ getItem: () => "{broken" })).toThrow();
  expect(() =>
    setTagExcluded(
      {
        getItem: () => null,
        setItem: () => {
          throw Error("read only");
        },
      },
      session,
      "music",
      true,
    ),
  ).toThrow("read only");
});

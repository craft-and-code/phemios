import { expect, it } from "vitest";
import {
  readTagPreferences,
  setTagExcluded,
  suggestionVocabulary,
  rememberEnteredTags,
} from "./tag-preferences";
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
it("keeps managed-local exclusions across ephemeral port changes without sharing them with remote accounts", () => {
  const storage = store(),
    local = { ...session, server: "http://127.0.0.1:50001" };
  setTagExcluded(storage, local, "music", true, "local");
  const entries = readTagPreferences(storage);
  expect(
    suggestionVocabulary(
      ["music"],
      entries,
      { ...local, server: "http://127.0.0.1:50002" },
      "local",
    ),
  ).toEqual([]);
  expect(suggestionVocabulary(["music"], entries, local, "server")).toEqual(["music"]);
});

it("keeps deleted vocabulary absent until explicitly entered again, without restoring other tags or owners", () => {
  const storage = store();
  setTagExcluded(storage, session, "music", true);
  setTagExcluded(storage, session, "singer", true);
  rememberEnteredTags(storage, { ...session, account: { ...session.account, id: "other" } }, [
    "music",
  ]);
  expect(suggestionVocabulary(["music", "singer"], readTagPreferences(storage), session)).toEqual(
    [],
  );
  rememberEnteredTags(storage, session, ["Músic"]);
  expect(suggestionVocabulary(["music", "singer"], readTagPreferences(storage), session)).toEqual([
    "music",
  ]);
});

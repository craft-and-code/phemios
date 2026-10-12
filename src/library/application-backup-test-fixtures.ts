import type { PersonalBackup } from "./application-backup";
/** Fictional private records only; no legacy browser storage or real account is consulted. */
export function personalBackupFixture(): PersonalBackup {
  return {
    origin: {
      source: "local",
      authority: "phemios-managed-local",
      accountId: "alice",
      name: "Alice",
    },
    podcasts: {
      feeds: [],
      episodes: [{ feed: "https://feeds.example.test/music.xml", id: "episode-1" }],
    },
    articles: [
      {
        language: "fr",
        pageId: 1,
        revision: 2,
        retrievedAt: 3,
        title: "Fictional music",
        text: "Saved text",
      },
    ],
  };
}
export function backupStorageFixture() {
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

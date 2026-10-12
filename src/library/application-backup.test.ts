import { personalBackupFixture } from "./application-backup-test-fixtures";
import { expect, it } from "vitest";
import { exportApplicationBackup, parseApplicationBackup } from "./application-backup";
import { exportPreferenceBackup } from "./preference-backup";
const storage = { getItem: () => null };
const privateData = personalBackupFixture;

it("includes only the explicitly read account records and keeps v1 imports compatible", () => {
  const personal = privateData(),
    raw = exportApplicationBackup(storage, personal);
  const backup = parseApplicationBackup(raw);
  expect(backup.personal).toEqual(personal);
  expect(backup.values).toEqual(parseApplicationBackup(exportPreferenceBackup(storage)).values);
  expect(parseApplicationBackup(exportPreferenceBackup(storage)).personal).toBeUndefined();
  expect(raw).not.toContain("nativeSession");
});
it("refuses corrupted or oversized private records before any import review", () => {
  const valid = JSON.parse(exportApplicationBackup(storage, privateData()));
  for (const personal of [
    { ...privateData(), credentials: "not portable" },
    { ...privateData(), articles: [...privateData().articles, ...privateData().articles] },
    {
      ...privateData(),
      articles: [{ ...privateData().articles[0], text: "x".repeat(512 * 1024 + 1) }],
    },
    { ...privateData(), podcasts: { feeds: [], episodes: [{ feed: "file:///secret", id: "x" }] } },
    {
      ...privateData(),
      podcasts: {
        feeds: [],
        episodes: Array.from({ length: 4097 }, (_, id) => ({
          feed: "https://feeds.example.test/music.xml",
          id: String(id),
        })),
      },
    },
    {
      ...privateData(),
      articles: [{ ...privateData().articles[0], text: "é".repeat(300 * 1024) }],
    },
  ])
    expect(() => parseApplicationBackup(JSON.stringify({ ...valid, personal }))).toThrow();
});
it("refuses unknown versions, oversized files and malformed provenance", () => {
  const valid = JSON.parse(exportApplicationBackup(storage, privateData()));
  expect(() => parseApplicationBackup(JSON.stringify({ ...valid, version: 3 }))).toThrow();
  expect(() =>
    parseApplicationBackup(
      JSON.stringify({
        ...valid,
        personal: { ...privateData(), origin: { ...privateData().origin, accountId: "" } },
      }),
    ),
  ).toThrow();
  expect(() => parseApplicationBackup(" ".repeat(12 * 1024 * 1024 + 1))).toThrow();
});

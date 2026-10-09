import { expect, it } from "vitest";
import { parseDoctor } from "./doctor";
const issue = {
  type: "missing_title",
  label: "Missing title",
  severity: "warning",
  detail: "Missing title in tags",
  files: ["music/01.flac"],
  file_count: 1,
  files_truncated: false,
};
const report = () => ({
  total: 1,
  offset: 0,
  limit: 50,
  scanned_at: 123,
  items: [issue],
  summary: { error: 0, warning: 1, info: 0 },
  unverified_files: 2,
  pending_analyses: 3,
});
it("retains actual findings and bounded file previews without inventing repairs", () => {
  expect(parseDoctor(report(), 0).items[0]).toEqual(issue);
  const files = Array.from({ length: 20 }, (_, i) => `music/${i}.flac`);
  expect(
    parseDoctor(
      { ...report(), items: [{ ...issue, files, file_count: 25, files_truncated: true }] },
      0,
    ).items[0]?.file_count,
  ).toBe(25);
});
it("rejects incomplete pages, summaries and dishonest file previews", () => {
  expect(() => parseDoctor({ ...report(), items: [] }, 0)).toThrow();
  expect(() => parseDoctor(report(), 50)).toThrow();
  expect(() =>
    parseDoctor({ ...report(), summary: { error: 0, warning: 2, info: 0 } }, 0),
  ).toThrow();
  expect(() => parseDoctor({ ...report(), items: [{ ...issue, file_count: 2 }] }, 0)).toThrow();
  expect(() => parseDoctor({ ...report(), items: [{ ...issue, severity: "fatal" }] }, 0)).toThrow();
});

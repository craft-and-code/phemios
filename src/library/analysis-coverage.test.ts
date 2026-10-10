import { expect, it } from "vitest";
import { parseCoverage } from "./analysis-coverage";
const sample = () => ({
  items: [
    {
      reference: "release:a",
      title: "A",
      artist: null,
      tracks: 4,
      current: 1,
      stale: 1,
      failed: 1,
      missing: 1,
      spectra: 2,
    },
  ],
  total: 1,
  offset: 0,
  limit: 50,
  scanned_at: 1,
  summary: { files: 4, current: 1, stale: 1, failed: 1, missing: 1 },
});
it("validates retained coverage partitions, paging and scan epochs without inventing zero results", () => {
  expect(parseCoverage(sample(), 0, 1).items[0]?.stale).toBe(1);
  expect(() => parseCoverage(sample(), 0, 2)).toThrow();
  expect(() =>
    parseCoverage({ ...sample(), items: [{ ...sample().items[0], spectra: 5 }] }, 0, 1),
  ).toThrow();
  expect(() =>
    parseCoverage({ ...sample(), summary: { ...sample().summary, current: 3 } }, 0, 1),
  ).toThrow();
  expect(() => parseCoverage({ ...sample(), total: 5 }, 0, 1)).toThrow();
});

it("refuses contradictory integrity counters while preserving unknown legacy coverage", () => {
  const integrity = {
    ok: 1,
    ko: 1,
    no_hash: 1,
    unchecked: 1,
    stale: 0,
    unsupported: 0,
    md5: 3,
    crc: 1,
  };
  const row = { ...sample(), items: [{ ...sample().items[0], integrity }] };
  expect(parseCoverage(row, 0, 1).items[0]?.integrity?.ko).toBe(1);
  expect(parseCoverage(sample(), 0, 1).items[0]?.integrity).toBeUndefined();
  expect(() =>
    parseCoverage(
      { ...row, items: [{ ...row.items[0], integrity: { ...integrity, ok: 5 } }] },
      0,
      1,
    ),
  ).toThrow();
});

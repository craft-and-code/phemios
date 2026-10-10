import { expect, it } from "vitest";
import { csvDocument, statisticsCsv } from "./statistics-csv";
import type { Statistics } from "./statistics";
it("quotes labels and preserves Unicode while neutralizing spreadsheet formulas", () => {
  const csv = csvDocument([
    ["group", 'A;B"C\nD', 12, "bytes"],
    ["group", "=1+1", 0, ""],
  ]);
  expect(csv.startsWith("\ufeff")).toBe(true);
  expect(csv).toContain('"A;B""C\nD"');
  expect(csv).toContain('"\'=1+1"');
});
it("exports all paged categories and refuses a changed epoch or replaced account", async () => {
  const group = (items: unknown[], total = items.length) => ({
    items,
    total,
    offset: 0,
    limit: 50,
    scanned_at: 1,
  });
  const base = {
    scanned_at: 1,
    by_codec: group([{ label: "FLAC", count: 2, bytes: 100 }], 51),
    by_quality: group([]),
    by_sample_rate: group([]),
    by_decade: group([]),
    by_country: group([]),
    roles: group([]),
    top: { artists: group([]), writers: group([]) },
  } as unknown as Statistics;
  const read = async (offset: number) =>
    offset
      ? {
          ...base,
          by_codec: { ...base.by_codec, offset, items: [{ label: "WAV", count: 1, bytes: 50 }] },
        }
      : base;
  expect(await statisticsCsv(read, [["total", "tracks", 3, ""]])).toContain('"WAV";"50";"bytes"');
  await expect(
    statisticsCsv(async (offset) => ({ ...(await read(offset)), scanned_at: offset ? 2 : 1 }), []),
  ).rejects.toThrow(/catalogue/);
  await expect(statisticsCsv(read, [], () => false)).rejects.toThrow();
});

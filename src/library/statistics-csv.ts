import { t } from "../i18n";
import type { Statistics } from "./statistics";
export type CsvRow = readonly [string, string, string | number, string];
/** Quote delimiters/newlines and neutralize spreadsheet formulas in untrusted labels. */
export function csvDocument(rows: readonly CsvRow[]): string {
  const cell = (value: string | number) => {
    let text = String(value);
    if (typeof value === "string" && /^[\s]*[=+@-]/.test(text)) text = "'" + text;
    return '"' + text.replaceAll('"', '""') + '"';
  };
  return (
    "\ufeff" +
    [["section", "measure", "value", "unit"], ...rows]
      .map((row) => row.map(cell).join(";"))
      .join("\r\n") +
    "\r\n"
  );
}
/** Export every paged dimension from one scan epoch; fail rather than publish a partial report. */
export async function statisticsCsv(
  read: (offset: number) => Promise<Statistics>,
  extra: readonly CsvRow[],
  current: () => boolean = () => true,
): Promise<string> {
  const first = await read(0),
    groups = ["by_codec", "by_quality", "by_sample_rate", "by_decade", "by_country"] as const;
  const totals = [
      ...groups.map((key) => first[key].total),
      first.roles.total,
      first.top.artists.total,
      first.top.writers.total,
    ],
    maximum = Math.max(0, ...totals);
  if (maximum > 100000) throw new Error(t("Trop de lignes pour cet export CSV."));
  const rows: CsvRow[] = [...extra];
  for (let offset = 0; offset < Math.max(1, maximum); offset += 50) {
    const page = offset === 0 ? first : await read(offset);
    if (
      !current() ||
      page.scanned_at !== first.scanned_at ||
      [
        ...groups.map((key) => page[key].total),
        page.roles.total,
        page.top.artists.total,
        page.top.writers.total,
      ].some((total, index) => total !== totals[index])
    )
      throw new Error(t("Le catalogue a changé ; relancez l’export."));
    for (const key of groups)
      for (const row of page[key].items) {
        rows.push([key, row.label, row.count, key === "by_country" ? "artists" : "count"]);
        if (key !== "by_country") rows.push([key, row.label, row.bytes, "bytes"]);
      }
    for (const row of page.roles.items) {
      rows.push(["roles", row.role, row.credits, "credits"]);
      rows.push(["roles", row.role, row.artists, "artists"]);
    }
    for (const key of ["artists", "writers"] as const)
      for (const row of page.top[key].items)
        rows.push([`top_${key}`, row.name, row.tracks, "tracks"]);
  }
  return csvDocument(rows);
}

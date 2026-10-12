import { t } from "../i18n";
/** Bounded UTF-8 CSV/TSV table; fields stay text and spreadsheet formulae are never evaluated. */
export interface ImportCsv {
  headers: string[];
  rows: string[][];
}
/** Accept common spreadsheet delimiters, RFC-style quoting and multiline cells; reject shifted fields. */
export function readImportCsv(input: string): ImportCsv {
  const fail = () =>
    new Error(t("Export CSV invalide. Utilisez un CSV UTF-8 avec une ligne d’en-tête."));
  if (
    !input ||
    input.length > 8 * 1024 * 1024 ||
    new TextEncoder().encode(input).length > 8 * 1024 * 1024
  )
    throw fail();
  const text = input.replace(/^\ufeff/, "");
  const counts = new Map([
    [",", 0],
    [";", 0],
    ["\t", 0],
  ]);
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (ch === '"') {
      if (quoted && text[i + 1] === '"') i++;
      else quoted = !quoted;
    } else if (!quoted && (ch === "\n" || ch === "\r")) break;
    else if (!quoted && counts.has(ch)) counts.set(ch, counts.get(ch)! + 1);
  }
  const delimiter = [...counts].sort((a, b) => b[1] - a[1])[0];
  if (!delimiter || !delimiter[1]) throw fail();
  const table: string[][] = [];
  let row: string[] = [],
    cell = "",
    inside = false,
    closed = false;
  function field() {
    row.push(cell);
    cell = "";
    closed = false;
    if (row.length > 32) throw fail();
  }
  function line() {
    field();
    if (row.some((value) => value.trim())) table.push(row);
    row = [];
    if (table.length > 5001) throw fail();
  }
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (ch.charCodeAt(0) < 32 && !["\r", "\n", "\t"].includes(ch)) throw fail();
    if (inside) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inside = false;
          closed = true;
        }
      } else cell += ch;
    } else if (ch === delimiter[0]) field();
    else if (ch === "\r" || ch === "\n") {
      line();
      if (ch === "\r" && text[i + 1] === "\n") i++;
    } else if (ch === '"') {
      if (cell || closed) throw fail();
      inside = true;
    } else {
      if (closed) throw fail();
      cell += ch;
    }
    if (cell.length > 16384) throw fail();
  }
  if (inside) throw fail();
  if (cell || row.length || closed) line();
  const headers = table.shift()?.map((value) => value.trim());
  if (
    !headers ||
    headers.some((value) => !value || value.length > 256) ||
    new Set(headers.map((value) => value.toLocaleLowerCase())).size !== headers.length ||
    table.some((value) => value.length !== headers.length)
  )
    throw fail();
  return { headers, rows: table };
}

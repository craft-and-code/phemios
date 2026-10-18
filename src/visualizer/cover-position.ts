import { normalizeName } from "../library/filtering";
interface Cover {
  reference: string;
  title: string;
}
/** Session memory survives view remounts; explicit reverse starts at its new first album. */
export function createCoverPosition() {
  let reference = "",
    reversed: boolean | undefined;
  return {
    restore(rows: readonly Cover[], reverse: boolean): string {
      if (reversed !== reverse || !rows.some((row) => row.reference === reference))
        reference = rows[0]?.reference ?? "";
      reversed = reverse;
      return reference;
    },
    select(value: string) {
      reference = value;
    },
  };
}
/** Letter landmarks reflect the real order, including reverse and nonalphabetical sorting. */
export function coverLetterStops<Row extends Pick<Cover, "title">>(
  rows: readonly Row[],
  name: (row: Row) => string = (row) => row.title,
) {
  let previous = "";
  return rows.flatMap((row, index) => {
    const initial = normalizeName(name(row)).slice(0, 1).toUpperCase();
    const letter = /^[A-Z]$/.test(initial) ? initial : "#";
    if (letter === previous) return [];
    previous = letter;
    return [{ letter, index }];
  });
}
export type CoverPosition = ReturnType<typeof createCoverPosition>;

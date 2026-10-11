import { expect, it } from "vitest";
import { createCoverPosition, coverLetterStops } from "./cover-position";
it("restores the front reference after remount, even when rows are recreated", () => {
  const memory = createCoverPosition();
  const rows = [
    { reference: "one", title: "Alpha" },
    { reference: "two", title: "Boreal" },
  ];
  expect(memory.restore(rows, false)).toBe("one");
  memory.select("two");
  expect(
    memory.restore(
      rows.map((row) => ({ ...row })),
      false,
    ),
  ).toBe("two");
  expect(memory.restore([...rows, { reference: "three", title: "Cobalt" }], false)).toBe("two");
});
it("starts at the reversed first row and refuses a no-longer-visible reference", () => {
  const memory = createCoverPosition();
  const rows = [
    { reference: "one", title: "Alpha" },
    { reference: "two", title: "Boreal" },
  ];
  memory.restore(rows, false);
  memory.select("one");
  expect(memory.restore([...rows].reverse(), true)).toBe("two");
  expect(memory.restore(rows.slice(0, 1), true)).toBe("one");
  expect(memory.restore([], true)).toBe("");
});
it("places letter landmarks at their actual visible positions in either order", () => {
  expect(coverLetterStops([{ title: "Écho" }, { title: "Eon" }, { title: "Zebra" }])).toEqual([
    { letter: "E", index: 0 },
    { letter: "Z", index: 2 },
  ]);
  expect(coverLetterStops([{ title: "Zebra" }, { title: "1st" }, { title: "Alpha" }])).toEqual([
    { letter: "Z", index: 0 },
    { letter: "#", index: 1 },
    { letter: "A", index: 2 },
  ]);
});

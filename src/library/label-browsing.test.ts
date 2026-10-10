import { expect, it } from "vitest";
import { labelExpression, labelHistogram, labelYearDomain } from "./label-browsing";
import type { Album, Filters } from "./types";
const albums: Album[] = [
  { reference: "release:a", artist: null, title: "Alpha", year: 1990, compilation: true, tags: [] },
  { reference: "release:b", artist: null, title: "Beta", year: 2000, compilation: false, tags: [] },
  {
    reference: "release:c",
    artist: null,
    title: "Beta edition",
    year: null,
    compilation: false,
    tags: [],
  },
];
const filters: Filters = {
  mode: "both",
  years: [2000, 2000],
  alphabet: [2, 2],
  includeUnknownYear: false,
  query: "",
};
it("counts label editions including albumless artists, ignoring only each rail's own interval", () => {
  expect(labelYearDomain(albums)).toEqual([1990, 2000]);
  expect(labelHistogram(albums, [], filters)).toEqual({
    years: [{ value: 2000, count: 1 }],
    alphabet: [{ value: 2, count: 1 }],
  });
  expect(labelHistogram(albums, [], { ...filters, mode: "none" }).alphabet).toEqual([
    { value: 1, count: 1 },
    { value: 2, count: 2 },
  ]);
});
it("captures the engine label identity and refuses non-label or invalid source references", () => {
  expect(
    JSON.parse(labelExpression("label:@phemios/local/independent", filters).slice(10)),
  ).toEqual({ ...filters, view: "label", label: "label:independent" });
  for (const ref of ["artist:test", "label:@phemios/other/id", "label:"])
    expect(() => labelExpression(ref, filters)).toThrow();
});

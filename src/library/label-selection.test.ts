import { createRoot, createSignal } from "solid-js";
import { expect, it } from "vitest";
import { createLabelSelection } from "./label-selection";
import type { Album } from "./types";
it("initializes each newly selected label from its own years and resets the previous label's filters", () => {
  let dispose!: () => void;
  const state = createRoot((end) => {
    dispose = end;
    const [label, setLabel] = createSignal("first");
    const albums = (): Album[] => [
      {
        reference: `release:${label()}`,
        artist: null,
        title: label(),
        year: label() === "first" ? 2020 : 1990,
        tags: [],
        compilation: false,
      },
    ];
    const selection = createLabelSelection(label, albums, () => true);
    return { selection, setLabel };
  });
  const { selection, setLabel } = state;
  try {
    expect(selection.filters().years).toEqual([2020, 2020]);
    selection.setFilters({ ...selection.filters(), query: "former", alphabet: [20, 20] });
    selection.setReverse(true);
    setLabel("second");
    expect(selection.filters().years).toEqual([1990, 1990]);
    expect(selection.filters().query).toBe("");
    expect(selection.filters().alphabet).toEqual([0, 26]);
    expect(selection.reverse()).toBe(false);
  } finally {
    dispose();
  }
});

it("extends the full label year range after synchronization while retaining an edited range", () => {
  let dispose!: () => void;
  const [albums, setAlbums] = createSignal<Album[]>([
    {
      reference: "release:one",
      artist: null,
      title: "One",
      year: 2000,
      tags: [],
      compilation: false,
    },
  ]);
  const selection = createRoot((end) => {
    dispose = end;
    return createLabelSelection(
      () => "label:one",
      albums,
      () => true,
    );
  });
  try {
    expect(selection.filters().years).toEqual([2000, 2000]);
    setAlbums([...albums(), { ...albums()[0]!, reference: "release:two", year: 1990 }]);
    expect(selection.filters().years).toEqual([1990, 2000]);
    selection.setFilters({ ...selection.filters(), years: [1995, 2000] });
    setAlbums([...albums(), { ...albums()[0]!, reference: "release:three", year: 2020 }]);
    expect(selection.filters().years).toEqual([1995, 2000]);
  } finally {
    dispose();
  }
});

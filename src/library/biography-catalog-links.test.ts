import { expect, it } from "vitest";
import { biographyLinker } from "./biography-links";

const artists = [
  { reference: "artist:solo", name: "Aster Vale", genre: "Heavy Metal" },
  { reference: "artist:band", name: "Northern Signal", genre: "Heavy Metal" },
];
const catalog = {
  albums: [
    {
      reference: "release:first",
      artist: "artist:band",
      title: "First Light",
      year: 1980,
      tags: ["Heavy Metal"],
    },
    {
      reference: "release:live",
      artist: "artist:band",
      title: "On Stage",
      year: 1990,
      tags: ["Rock"],
    },
  ],
  tracks: [
    {
      reference: "track:studio",
      title: "Silver Wings",
      release: "release:first",
      album_title: "First Light",
      track_no: 1,
    },
    {
      reference: "track:live",
      title: "Silver Wings",
      release: "release:live",
      album_title: "On Stage",
      track_no: 2,
    },
    {
      reference: "track:only",
      title: "Distant Shore",
      release: "release:first",
      album_title: "First Light",
      track_no: 3,
    },
  ],
};

it("links known genres and retained track placements without changing attributed text", () => {
  const text =
    "Aster Vale joined Northern Signal, played heavy metal and sang Silver Wings and Distant Shore.";
  const parts = biographyLinker(artists, "artist:solo", catalog)(text);
  expect(parts.map((part) => part.text).join("")).toBe(text);
  expect(parts.filter((part) => part.target).map((part) => [part.text, part.target])).toEqual([
    ["Northern Signal", { kind: "artist", reference: "artist:band" }],
    ["heavy metal", { kind: "genre", name: "Heavy Metal" }],
    [
      "Silver Wings",
      {
        kind: "tracks",
        tracks: [
          {
            reference: "track:studio",
            title: "Silver Wings",
            album: "First Light",
            artist: "Northern Signal",
            year: 1980,
            number: 1,
          },
          {
            reference: "track:live",
            title: "Silver Wings",
            album: "On Stage",
            artist: "Northern Signal",
            year: 1990,
            number: 2,
          },
        ],
      },
    ],
    [
      "Distant Shore",
      {
        kind: "tracks",
        tracks: [
          {
            reference: "track:only",
            title: "Distant Shore",
            album: "First Light",
            artist: "Northern Signal",
            year: 1980,
            number: 3,
          },
        ],
      },
    ],
  ]);
});

it("never links another source's artists, genres or tracks, including an unknown legacy projection", () => {
  const other = "@phemios/local/";
  const link = biographyLinker(
    [
      ...artists,
      { reference: `artist:${other}other`, name: "Foreign Ensemble", genre: "Other Style" },
    ],
    "artist:solo",
    {
      albums: [
        ...catalog.albums,
        {
          reference: `release:${other}other`,
          title: "Other",
          artist: null,
          year: null,
          tags: ["Unknown Genre"],
        },
      ],
      tracks: [
        ...catalog.tracks,
        {
          reference: `track:${other}other`,
          title: "Foreign Song",
          release: null,
          album_title: null,
          track_no: null,
        },
      ],
    },
  );
  const text = "Foreign Ensemble, Other Style, Unknown Genre and Foreign Song.";
  expect(link(text)).toEqual([{ text }]);
  expect(biographyLinker(artists, "artist:solo")("Silver Wings")).toEqual([
    { text: "Silver Wings" },
  ]);
});

it("preserves longest whole-name matching and literal HTML, with artists preceding overlapping title names", () => {
  const link = biographyLinker(artists, "artist:solo", {
    ...catalog,
    tracks: [
      ...catalog.tracks,
      { ...catalog.tracks[2]!, reference: "track:same-name", title: "Northern Signal" },
      { ...catalog.tracks[2]!, reference: "track:prefix", title: "Distant" },
      { ...catalog.tracks[2]!, reference: "track:punctuation", title: "A+B (Live)" },
    ],
  });
  const text =
    "<b>Northern Signal</b> — Distant Shore, A+B (Live); Distant Shores and hardrock stay literal.";
  const parts = link(text);
  expect(parts.map((part) => part.text).join("")).toBe(text);
  expect(parts.filter((part) => part.target).map((part) => part.text)).toEqual([
    "Northern Signal",
    "Distant Shore",
    "A+B (Live)",
  ]);
  expect(parts.find((part) => part.text === "Northern Signal")?.target).toEqual({
    kind: "artist",
    reference: "artist:band",
  });
});

it("retains every distinct edition once and never invents a recording identity or destination", () => {
  const link = biographyLinker(artists, "artist:solo", {
    ...catalog,
    tracks: [...catalog.tracks, catalog.tracks[0]!],
  });
  const first = link("Silver Wings")[0]?.target;
  expect(first?.kind).toBe("tracks");
  if (first?.kind !== "tracks") throw new Error("Expected track choices");
  expect(first.tracks.map((row) => row.reference)).toEqual(["track:studio", "track:live"]);
  expect(link("An Unowned Song")).toEqual([{ text: "An Unowned Song" }]);
  expect(link("Silver Wings")[0]?.target).toEqual(first);
});

it("links literal titles in a large retained catalogue without constructing a catalogue-sized pattern", () => {
  const tracks = Array.from({ length: 25000 }, (_, index) => ({
    reference: `track:retained-${index}`,
    title: `Retained Song ${index} (Live)`,
    release: null,
    album_title: null,
    track_no: null,
  }));
  const link = biographyLinker(artists, "artist:solo", { albums: [], tracks });
  const parts = link("Retained Song 24999 (Live), and Retained Song 1 (Live).");
  expect(parts.filter((part) => part.target).map((part) => part.text)).toEqual([
    "Retained Song 24999 (Live)",
    "Retained Song 1 (Live)",
  ]);
});

it("offers the explicitly qualified versions of a multiword title without linking isolated prose words", () => {
  const link = biographyLinker(artists, "artist:solo", {
    ...catalog,
    tracks: [
      { ...catalog.tracks[0]!, title: "Silver Wings (charity version)" },
      { ...catalog.tracks[1]!, title: "Silver Wings (live)" },
      { ...catalog.tracks[2]!, title: "Silver" },
      { ...catalog.tracks[2]!, reference: "track:night", title: "Night" },
    ],
  });
  const text = "Silver Wings, the Prince of Night, and “Night”.";
  const parts = link(text);
  expect(parts.filter((part) => part.target).map((part) => part.text)).toEqual([
    "Silver Wings",
    "Night",
  ]);
  const first = parts[0]?.target;
  expect(first?.kind).toBe("tracks");
  if (first?.kind !== "tracks") throw new Error("Expected edition choices");
  expect(first.tracks.map((track) => track.title)).toEqual([
    "Silver Wings (charity version)",
    "Silver Wings (live)",
  ]);
});

it("does not turn an unknown compound genre into its shorter catalogue genre", () => {
  const link = biographyLinker(
    [{ reference: "artist:solo", name: "Aster Vale", genre: "Metal" }],
    "artist:solo",
  );
  expect(link("Le heavy metal reste du texte.")).toEqual([
    { text: "Le heavy metal reste du texte." },
  ]);
  expect(
    link("Du Metal, ou « Metal ».")
      .filter((part) => part.target)
      .map((part) => part.text),
  ).toEqual(["Metal", "Metal"]);
});

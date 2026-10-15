import { expect, it } from "vitest";
import { playbackSelection, queueAdditionSelection } from "./playback-selection";
const album = {
  reference: "release:one",
  title: "First",
  artist: null,
  year: 1990,
  compilation: false,
  tags: [],
};
it("retains the server order and per-album positions across a discography", () => {
  const rows = {
    items: [
      {
        reference: "track:b",
        title: "Second",
        release: album.reference,
        number: 2,
        album_total: 3,
      },
      { reference: "track:a", title: "First", release: album.reference, number: 1, album_total: 3 },
    ],
  };
  expect(playbackSelection(rows, [album], []).map((r) => r.number)).toEqual([2, 1]);
  expect(() => playbackSelection(rows, [], [])).toThrow(/resynchronisez/);
  rows.items[0]!.number = 4;
  expect(() => playbackSelection(rows, [album], [])).toThrow();
});

it("plays a track without inventing an album, but rejects missing release identities", () => {
  const row = { reference: "track:solo", title: "Solo", release: null, number: 1, album_total: 1 };
  expect(playbackSelection({ items: [row] }, [], [])[0]?.album).toBeNull();
  expect(() => playbackSelection({ items: [{ ...row, release: undefined }] }, [], [])).toThrow();
});

it("scopes contextual additions to the exact qualified track while keeping its album position", () => {
  const first = {
    reference: "track:@phemios/local/one",
    title: "First",
    release: album.reference,
    number: 1,
    album_total: 2,
  };
  const second = { ...first, reference: "track:@phemios/local/two", title: "Second", number: 2 };
  const items = [first, second];
  expect(queueAdditionSelection({ items }, [album], [], second.reference)).toEqual([
    expect.objectContaining({ reference: second.reference, number: 2, albumTotal: 2 }),
  ]);
  expect(() => queueAdditionSelection({ items }, [album], [], "track:@phemios/server/two")).toThrow(
    /resynchronisez/,
  );
  expect(() =>
    queueAdditionSelection({ items: [second, second] }, [album], [], second.reference),
  ).toThrow(/resynchronisez/);
});
it("preserves complete albums, artist selections and explicit lists including repeated occurrences", () => {
  const row = {
    reference: "track:one",
    title: "First",
    release: album.reference,
    number: 1,
    album_total: 1,
  };
  for (const reference of ["release:one", "artist:one", undefined])
    expect(queueAdditionSelection({ items: [row, row] }, [album], [], reference)).toHaveLength(2);
});

it("resolves same-named artists by their source-qualified identity without changing selection order or fallback names", () => {
  const artists = ["local", "server"].map((source) => ({
    reference: `artist:@phemios/${source}/example`,
    name: `${source} artist`,
    genre: "",
    country: null,
    biography: "",
    artwork: false,
  }));
  const albums = artists.map((artist, index) => ({
    ...album,
    reference: `release:${index}`,
    artist: artist.reference,
  }));
  const row = {
    reference: "track:one",
    title: "Track",
    release: albums[1]!.reference,
    number: 1,
    album_total: 1,
  };
  const selected = playbackSelection(
    { items: [row, { ...row, release: albums[0]!.reference }, { ...row, release: null }] },
    albums,
    artists,
  );
  expect(selected.map((item) => item.artist)).toEqual([
    "server artist",
    "local artist",
    "Titre sans album",
  ]);
  expect(playbackSelection({ items: [row] }, albums, [])[0]?.artist).toBe("Artistes divers");
});

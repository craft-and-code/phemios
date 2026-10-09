import type { Album, Artist } from "./types";
interface Index {
  artistsByAlbum: Map<string, Artist[]>;
  albumsByArtist: Map<string, Album[]>;
}
const indexes = new WeakMap<readonly Album[], WeakMap<readonly Artist[], Index>>();
/** Index immutable snapshots once; typing and scrolling never scan the cross product. */
export function catalogIndex(artists: readonly Artist[], albums: readonly Album[]): Index {
  const held = indexes.get(albums)?.get(artists);
  if (held) return held;
  const artistsByRef = new Map(artists.map((artist) => [artist.reference, artist])),
    albumsByRef = new Map(albums.map((album) => [album.reference, album]));
  const ids = new Map<string, Set<string>>();
  for (const album of albums)
    ids.set(
      album.reference,
      new Set([...(album.artist ? [album.artist] : []), ...(album.contributors ?? [])]),
    );
  for (const artist of artists)
    for (const reference of artist.releaseRefs ?? []) ids.get(reference)?.add(artist.reference);
  const index: Index = { artistsByAlbum: new Map(), albumsByArtist: new Map() };
  for (const [reference, references] of ids) {
    const album = albumsByRef.get(reference);
    if (!album) continue;
    const related: Artist[] = [];
    for (const id of references) {
      const artist = artistsByRef.get(id);
      if (!artist) continue;
      related.push(artist);
      const releases = index.albumsByArtist.get(id) ?? [];
      releases.push(album);
      index.albumsByArtist.set(id, releases);
    }
    index.artistsByAlbum.set(reference, related);
  }
  let byArtist = indexes.get(albums);
  if (!byArtist) {
    byArtist = new WeakMap();
    indexes.set(albums, byArtist);
  }
  byArtist.set(artists, index);
  return index;
}

/** Artist cards play the artist's principal discography; illustration never selects the queue. */
export function artistCardSelection(artist: Artist, related: readonly Album[]) {
  return {
    reference: artist.reference,
    title: artist.name,
    cover: related.find((album) => album.cover) ?? related[0],
  };
}

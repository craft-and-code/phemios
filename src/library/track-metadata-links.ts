import type { Artist, Album } from "./types";
import type { TrackDetail } from "./track-detail";
import { normalizeName } from "./filtering";
import { referenceSource, type SourceId } from "./sources";
export type MetadataBrowse = {
  kind: "browse";
  section: "artists" | "albums" | "genres" | "labels";
  query: string;
  year?: number;
};
export type MetadataTarget =
  | { kind: "route"; href: string }
  | { kind: "label"; name: string; source: SourceId }
  | MetadataBrowse;
/** Match exact source-owned identities; raw names without a unique entity open an explicit catalogue search. */
export function trackMetadataTarget(
  key: string,
  value: string,
  detail: Pick<TrackDetail, "reference" | "release" | "credits">,
  artists: readonly Artist[],
  albums: readonly Album[],
): MetadataTarget | undefined {
  const field = key.toLowerCase().replace(/[^a-z]/g, ""),
    name = normalizeName(value),
    source = referenceSource(detail.reference);
  if (!name) return;
  const browse = (section: MetadataBrowse["section"]): MetadataBrowse => ({
    kind: "browse",
    section,
    query: value,
  });
  const link = (kind: "artist" | "album", reference: string): MetadataTarget => ({
    kind: "route",
    href: `#/${kind}/${encodeURIComponent(reference)}`,
  });
  if (["genre", "genres"].includes(field)) return browse("genres");
  if (["label", "recordlabel", "publisher", "organization"].includes(field))
    return { kind: "label", name: value, source };
  if (["album", "albumtitle"].includes(field)) {
    const matches = albums.filter(
      (album) => referenceSource(album.reference) === source && normalizeName(album.title) === name,
    );
    const selected = matches.find((album) => album.reference === detail.release);
    return selected
      ? link("album", selected.reference)
      : matches.length === 1
        ? link("album", matches[0]!.reference)
        : browse("albums");
  }
  if (["date", "year", "originaldate", "originalyear"].includes(field)) {
    const year = /^(\d{4})(?:[-/]|$)/.exec(value.trim())?.[1];
    return year ? { kind: "browse", section: "albums", query: "", year: Number(year) } : undefined;
  }
  if (
    [
      "artist",
      "artists",
      "trackartist",
      "trackartists",
      "albumartist",
      "albumartists",
      "artistsort",
      "albumartistsort",
      "trackartistsort",
      "performer",
      "performers",
      "lyricist",
      "lyricswriter",
      "composer",
      "composers",
      "conductor",
      "arranger",
      "producer",
      "remixer",
      "engineer",
      "mixingengineer",
      "masteringengineer",
      "choir",
      "mixer",
      "editor",
      "orchestra",
      "ensemble",
      "band",
      "soloist",
      "soloists",
      "writer",
      "writers",
      "vocals",
      "vocalist",
      "backgroundvocals",
      "executiveproducer",
      "coproducer",
      "recordingengineer",
      "assistantengineer",
      "soundengineer",
      "albumproducer",
      "albumengineer",
      "albummixer",
      "albumarranger",
      "albummasteringengineer",
      "djmixer",
    ].includes(field) ||
    field.startsWith("performer")
  ) {
    const matchesFor = (candidate: string) =>
      new Set([
        ...detail.credits
          .filter(
            (credit) =>
              referenceSource(credit.reference) === source &&
              normalizeName(credit.name) === candidate,
          )
          .map((credit) => credit.reference),
        ...artists
          .filter(
            (artist) =>
              referenceSource(artist.reference) === source &&
              normalizeName(artist.name) === candidate,
          )
          .map((artist) => artist.reference),
      ]);
    let matches = matchesFor(name);
    if (!matches.size && ["artistsort", "albumartistsort", "trackartistsort"].includes(field)) {
      const parts = value.split(",").map((part) => part.trim());
      if (parts.length === 2 && parts.every(Boolean))
        matches = matchesFor(normalizeName(`${parts[1]} ${parts[0]}`));
    }
    return matches.size === 1 ? link("artist", [...matches][0]!) : browse("artists");
  }
}

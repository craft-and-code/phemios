import { t } from "../i18n";
import type { Album, Artist } from "../library/types";
import type { Annotation } from "../library/server";
import type { AnnotationPatch } from "../library/annotation-writes";
import type { ImportCsv } from "./csv";
/** Only identity columns are suggested; personal fields always require explicit user mapping. */
export interface RoonMapping {
  artist: number;
  album: number;
  year: number;
  rating: number;
  loved: number;
  tags: number;
  note: number;
  favourites: boolean;
  tagSeparator: "," | ";" | "|";
}
export type ImportStatus =
  "ready" | "missing" | "ambiguous" | "invalid" | "duplicate" | "conflict" | "unchanged";
export interface RoonRow {
  line: number;
  title: string;
  artist: string;
  status: ImportStatus;
  reference?: string;
  desired?: AnnotationPatch;
}
const name = (value: string) =>
  value.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase();
export function suggestRoonMapping(headers: readonly string[]): RoonMapping {
  const find = (names: string[]) => headers.findIndex((header) => names.includes(name(header)));
  return {
    artist: find(["artist", "artists", "album artist", "albumartist", "artiste"]),
    album: find(["album", "album title", "title", "titre"]),
    year: find(["year", "release year", "année"]),
    rating: -1,
    loved: -1,
    tags: -1,
    note: -1,
    favourites: false,
    tagSeparator: ";",
  };
}
/** Missing values never erase annotations; different saved notes/stars make the whole row a conflict. */
export function additiveImportPatch(
  desired: AnnotationPatch,
  saved: Annotation | null | undefined,
): AnnotationPatch | undefined {
  if (
    (desired.rating != null && saved?.rating != null && desired.rating !== saved.rating) ||
    (desired.note && saved?.note && desired.note !== saved.note)
  )
    return undefined;
  const patch: AnnotationPatch = {};
  if (desired.loved && !saved?.loved) patch.loved = true;
  if (desired.rating != null && saved?.rating == null) patch.rating = desired.rating;
  if (desired.note && !saved?.note) patch.note = desired.note;
  if (desired.tags?.length) {
    const tags = [...new Set([...(saved?.tags ?? []), ...desired.tags])];
    if (tags.length > 100 || tags.some((tag) => new TextEncoder().encode(tag).length > 256))
      return undefined;
    if (tags.length !== (saved?.tags.length ?? 0)) patch.tags = tags;
  }
  if (new TextEncoder().encode(JSON.stringify(patch)).length > 15000) return undefined;
  return patch;
}
/** Exact normalized album/artist and optional year matching never silently chooses another edition. */
export function planRoonImport(
  table: ImportCsv,
  mapping: RoonMapping,
  albums: readonly Album[],
  artists: readonly Artist[],
  annotations: Readonly<Record<string, Annotation | undefined>>,
): RoonRow[] {
  const indices = [
    mapping.artist,
    mapping.album,
    mapping.year,
    mapping.rating,
    mapping.loved,
    mapping.tags,
    mapping.note,
  ];
  if (
    indices.some(
      (index) => !Number.isInteger(index) || index < -1 || index >= table.headers.length,
    ) ||
    mapping.artist < 0 ||
    mapping.album < 0 ||
    !([",", ";", "|"] as string[]).includes(mapping.tagSeparator)
  )
    throw new Error(t("Choisissez les colonnes Artiste et Album."));
  const used = indices.filter((index) => index >= 0);
  if (new Set(used).size !== used.length)
    throw new Error(t("Une colonne ne peut pas correspondre à plusieurs champs."));
  const names = new Map(artists.map((artist) => [artist.reference, name(artist.name)]));
  const index = new Map<string, Album[]>();
  for (const album of albums) {
    const key = JSON.stringify([names.get(album.artist ?? ""), name(album.title)]);
    const bucket = index.get(key);
    if (bucket) bucket.push(album);
    else index.set(key, [album]);
  }
  const plans = table.rows.map((cells, line): RoonRow => {
    const value = (column: number) => (column < 0 ? "" : (cells[column] ?? ""));
    const title = value(mapping.album).trim(),
      artist = value(mapping.artist).trim();
    const row: RoonRow = { line: line + 2, title, artist, status: "invalid" };
    const year = value(mapping.year).trim(),
      rating = value(mapping.rating).trim(),
      loved = name(value(mapping.loved));
    if (
      !title ||
      !artist ||
      (year && !/^[1-9]\d{3}$/.test(year)) ||
      (rating && !/^[0-5]$/.test(rating)) ||
      (loved && !["true", "false", "yes", "no", "oui", "non", "1", "0"].includes(loved))
    )
      return row;
    const desired: AnnotationPatch = {};
    if (mapping.favourites || ["true", "yes", "oui", "1"].includes(loved)) desired.loved = true;
    if (rating && rating !== "0") desired.rating = Number(rating);
    const note = value(mapping.note);
    if (note.trim()) desired.note = note;
    const tags = value(mapping.tags)
      .split(mapping.tagSeparator)
      .map((tag) => tag.trim())
      .filter(Boolean);
    if (tags.length) desired.tags = [...new Set(tags)];
    if (
      desired.tags &&
      (desired.tags.length > 100 ||
        desired.tags.some((tag) => new TextEncoder().encode(tag).length > 256))
    )
      return row;
    if (new TextEncoder().encode(JSON.stringify(desired)).length > 15000) return row;
    const matches = (index.get(JSON.stringify([name(artist), name(title)])) ?? []).filter(
      (album) => !year || album.year === Number(year),
    );
    if (matches.length !== 1) return { ...row, status: matches.length ? "ambiguous" : "missing" };
    const reference = matches[0]!.reference;
    const patch = additiveImportPatch(desired, annotations[reference]);
    return {
      ...row,
      reference,
      desired,
      status: patch === undefined ? "conflict" : Object.keys(patch).length ? "ready" : "unchanged",
    };
  });
  const occurrences = new Map<string, number>();
  for (const row of plans)
    if (row.reference) occurrences.set(row.reference, (occurrences.get(row.reference) ?? 0) + 1);
  return plans.map((row) =>
    row.reference && occurrences.get(row.reference)! > 1 ? { ...row, status: "duplicate" } : row,
  );
}
export function importStatusLabel(status: ImportStatus): string {
  return {
    ready: t("À importer"),
    missing: t("Album absent"),
    ambiguous: t("Plusieurs éditions"),
    invalid: t("Valeurs invalides"),
    duplicate: t("Doublon dans l’export"),
    conflict: t("Annotation existante différente"),
    unchanged: t("Déjà enregistré ou aucune donnée personnelle"),
  }[status];
}

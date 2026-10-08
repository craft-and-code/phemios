export interface Page<T> {
  items: T[];
  total: number;
  offset: number;
  limit: number;
  scanned_at: number;
}
export interface Bucket {
  label: string;
  count: number;
  bytes: number;
}
export interface RoleCount {
  role: string;
  artists: number;
  credits: number;
}
export interface ArtistCount {
  reference: string | null;
  name: string;
  tracks: number;
}
export interface Statistics {
  scanned_at: number;
  files: number;
  tracks: number;
  albums: number;
  compilations: number;
  artists: number;
  album_artists: number;
  labels: number;
  genres: number;
  duration_ms: number;
  bytes: number;
  tracks_without_album: number;
  completeness: { covers: number; years: number; genres: number; mbid: number };
  by_codec: Page<Bucket>;
  by_quality: Page<Bucket>;
  by_sample_rate: Page<Bucket>;
  by_decade: Page<Bucket>;
  by_country: Page<Bucket>;
  roles: Page<RoleCount>;
  top: { artists: Page<ArtistCount>; writers: Page<ArtistCount> };
}
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Statistiques Aède invalides.");
  return value as Record<string, unknown>;
}
function count(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0)
    throw new Error("Mesure Aède invalide.");
  return value;
}
function text(value: unknown): string {
  if (typeof value !== "string") throw new Error("Libellé Aède invalide.");
  return value;
}
function page<T>(
  value: unknown,
  offset: number,
  epoch: number,
  parse: (value: Record<string, unknown>) => T,
): Page<T> {
  const raw = object(value),
    total = count(raw.total),
    limit = count(raw.limit);
  if (
    count(raw.scanned_at) !== epoch ||
    count(raw.offset) !== offset ||
    limit !== 50 ||
    !Array.isArray(raw.items) ||
    raw.items.length !== Math.min(limit, Math.max(0, total - offset))
  )
    throw new Error("Pagination des statistiques incohérente. Actualisez la page.");
  return {
    items: raw.items.map((value) => parse(object(value))),
    total,
    limit,
    offset,
    scanned_at: epoch,
  };
}
/** Validate real server measurements; malformed or partial pages cannot imply zero. */
export function parseStatistics(value: unknown, offset: number): Statistics {
  const raw = object(value),
    epoch = count(raw.scanned_at),
    completeness = object(raw.completeness),
    top = object(raw.top);
  const ratio = (value: unknown) => {
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1)
      throw new Error("Complétude Aède invalide.");
    return value;
  };
  const bucket = (value: unknown) =>
    page(value, offset, epoch, (row) => ({
      label: text(row.label),
      count: count(row.count),
      bytes: count(row.bytes),
    }));
  const ranking = (value: unknown) =>
    page(value, offset, epoch, (row) => ({
      reference: row.reference === null ? null : text(row.reference),
      name: text(row.name),
      tracks: count(row.tracks),
    }));
  return {
    scanned_at: epoch,
    files: count(raw.files),
    tracks: count(raw.tracks),
    albums: count(raw.albums),
    compilations: count(raw.compilations),
    artists: count(raw.artists),
    album_artists: count(raw.album_artists),
    labels: count(raw.labels),
    genres: count(raw.genres),
    duration_ms: count(raw.duration_ms),
    bytes: count(raw.bytes),
    tracks_without_album: count(raw.tracks_without_album),
    completeness: {
      covers: ratio(completeness.covers),
      years: ratio(completeness.years),
      genres: ratio(completeness.genres),
      mbid: ratio(completeness.mbid),
    },
    by_codec: bucket(raw.by_codec),
    by_quality: bucket(raw.by_quality),
    by_sample_rate: bucket(raw.by_sample_rate),
    by_decade: bucket(raw.by_decade),
    by_country: bucket(raw.by_country),
    roles: page(raw.roles, offset, epoch, (row) => ({
      role: text(row.role),
      artists: count(row.artists),
      credits: count(row.credits),
    })),
    top: { artists: ranking(top.artists), writers: ranking(top.writers) },
  };
}
/** Each table has independent paging; tables at the same offset share one bounded read. */
export function statisticsReader(read: (offset: number) => Promise<unknown>) {
  const cache = new Map<number, Promise<Statistics>>();
  let epoch: number | undefined;
  return (offset: number) => {
    const held = cache.get(offset);
    if (held) return held;
    const pending = read(offset)
      .then((value) => {
        const parsed = parseStatistics(value, offset);
        if (epoch !== undefined && epoch !== parsed.scanned_at)
          throw new Error("Le catalogue a changé. Actualisez les statistiques.");
        epoch = parsed.scanned_at;
        return parsed;
      })
      .catch((failure) => {
        cache.delete(offset);
        throw failure;
      });
    cache.set(offset, pending);
    return pending;
  };
}
export const numberLabel = (value: number) => value.toLocaleString("fr");
export function bytesLabel(value: number): string {
  const units = ["o", "Kio", "Mio", "Gio", "Tio", "Pio"];
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index++;
  }
  return `${value.toLocaleString("fr", { maximumFractionDigits: index ? 1 : 0 })} ${units[index]}`;
}
export function durationLabel(ms: number): string {
  const seconds = Math.floor(ms / 1000),
    days = Math.floor(seconds / 86400),
    hours = Math.floor((seconds % 86400) / 3600),
    minutes = Math.floor((seconds % 3600) / 60);
  return `${days ? `${days} j ` : ""}${hours} h ${minutes} min`;
}

/** Doctor is read-only; absent measurements stay an error rather than invented zeroes. */
export function parseDiagnosis(value: unknown) {
  const raw = object(value),
    summary = object(raw.summary);
  return {
    summary: {
      error: count(summary.error),
      warning: count(summary.warning),
      info: count(summary.info),
    },
    unverified_files: count(raw.unverified_files),
    pending_analyses: count(raw.pending_analyses),
  };
}

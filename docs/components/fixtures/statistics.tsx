import type { Statistics, Page } from "../../../src/library/statistics";
/** Bounded fictional pages exercise the actual table without a catalog service. */
export function statisticsFixture(offset = 0): Statistics {
  const empty = <T,>(): Page<T> => ({ items: [], total: 0, offset, limit: 50, scanned_at: 1 });
  return {
    scanned_at: 1,
    files: 120,
    tracks: 120,
    albums: 12,
    compilations: 1,
    artists: 65,
    album_artists: 12,
    labels: 3,
    genres: 4,
    duration_ms: 30000000,
    bytes: 1234567890,
    tracks_without_album: 0,
    completeness: { covers: 0.8, years: 1, genres: 1, mbid: 0.5 },
    by_codec: empty(),
    by_quality: empty(),
    by_sample_rate: empty(),
    by_decade: empty(),
    by_country: empty(),
    roles: empty(),
    top: {
      writers: empty(),
      artists: {
        items: Array.from({ length: Math.min(50, 65 - offset) }, (_, i) => ({
          reference: null,
          name: `Example artist ${offset + i + 1}`,
          tracks: 65 - offset - i,
        })),
        total: 65,
        offset,
        limit: 50,
        scanned_at: 1,
      },
    },
  };
}

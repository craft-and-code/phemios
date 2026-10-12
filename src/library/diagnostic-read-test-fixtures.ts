import type { AccountSession } from "./server";
import type { Statistics } from "./statistics";
export const diagnosticOwner = (server: string): AccountSession => ({
  server,
  account: { id: "same-id", username: "fixture", role: "user" },
});
export function diagnosticStatistics(offset = 0, albums = 2): Statistics {
  const page = <T>(items: T[] = [], total = items.length) => ({
    items,
    total,
    offset,
    limit: 50,
    scanned_at: 1,
  });
  return {
    scanned_at: 1,
    files: 52,
    tracks: 52,
    albums,
    compilations: 0,
    artists: 52,
    album_artists: 2,
    labels: 1,
    genres: 1,
    duration_ms: 60000,
    bytes: 1000,
    tracks_without_album: 0,
    completeness: { covers: 0.5, years: 1, genres: 1, mbid: 0 },
    by_codec: page(),
    by_quality: page(),
    by_sample_rate: page(),
    by_decade: page(),
    by_country: page(),
    roles: page(),
    top: {
      artists: page(
        Array.from({ length: Math.min(50, Math.max(0, 52 - offset)) }, (_, i) => ({
          reference: `artist:fixture-${offset + i}`,
          name: `Fixture ${offset + i}`,
          tracks: 1,
        })),
        52,
      ),
      writers: page(),
    },
  };
}
export function diagnosticDoctor(offset = 0) {
  return {
    scanned_at: 1,
    total: 1,
    offset,
    limit: 50,
    summary: { error: 0, warning: 1, info: 0 },
    unverified_files: 2,
    pending_analyses: 3,
    items: offset
      ? []
      : [
          {
            type: "missing_title",
            label: "Missing title",
            severity: "warning",
            detail: "Missing title in tags",
            files: ["music/fixture.flac"],
            file_count: 1,
            files_truncated: false,
          },
        ],
  };
}

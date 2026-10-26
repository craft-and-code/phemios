import properties from "./properties.json";
import waveforms from "./waveforms.json";
import { demoAccount, demoAuthor, demoMusic, demoSnapshot } from "./catalog";
const annotations = new Map<string, unknown>();
const preferences: Record<string, unknown> = {};
/** Offline demonstration operations never contact Aède or external metadata services. */
export function demoRequest(
  path: string,
  query: Record<string, string>,
  method: string,
  body: unknown,
  server: string,
): unknown {
  const snapshot = demoSnapshot(server),
    reference = query.ref ?? query.reference ?? query.track ?? "";
  const queryText = query.q?.trim().normalize("NFKD").toLocaleLowerCase() ?? "";
  const matches = (text: string) =>
    !queryText || text.normalize("NFKD").toLocaleLowerCase().includes(queryText);
  const rows = snapshot.tracks.filter(
    (t) =>
      (!reference ||
        t.reference === reference ||
        t.release === reference ||
        t.artist === reference) &&
      matches(
        `${t.title} ${t.album_title} ${demoAuthor(t.artist.replace("artist:web-demo-", "")).name}`,
      ),
  );
  const offset = Number(query.offset ?? 0),
    limit = Number(query.limit ?? 50);
  const page = (items: unknown[]) => ({
    items: items.slice(offset, offset + limit),
    offset,
    limit,
    total: items.length,
    scanned_at: 1,
  });
  if (path === "/api/auth/v1/session") return demoAccount;
  if (path === "/api/v1/library") return { scanned_at: 1 };
  if (path === "/api/v1/status")
    return {
      status: "ok",
      capabilities: [
        "account_preferences",
        "track_catalog_pages",
        "album_track_pages",
        "track_waveform",
      ],
      versions: {},
    };
  if (path === "/api/v1/presentation/tracks" || path === "/api/v1/tracks") return page(rows);
  if (path === "/api/v1/presentation/albums")
    return page(
      snapshot.albums.filter((a) =>
        matches(`${a.title} ${demoAuthor(a.artist.replace("artist:web-demo-", "")).name}`),
      ),
    );
  if (path === "/api/v1/presentation/artists")
    return page(snapshot.artists.filter((a) => matches(a.name)));
  if (path === "/api/v1/presentation/playback")
    return {
      items: rows.map((t) => ({
        reference: t.reference,
        title: t.title,
        release: t.release,
        number: 1,
        album_total: 1,
      })),
    };
  if (path === "/api/v1/waveform")
    return Object.values(waveforms).find((row) => row.reference === reference);
  if (path.includes("/lyrics")) return { track: reference, lyrics: null };
  if (path === "/api/me/v1/preferences") {
    if (method !== "GET" && body && typeof body === "object")
      Object.assign(preferences, (body as { values?: object }).values ?? body);
    return { values: preferences };
  }
  if (path === "/api/me/v1/annotations") return page([...annotations.values()]);
  if (path === "/api/me/v1/annotation") {
    if (method !== "GET") {
      const value = body as Record<string, unknown>;
      const ref = String(value.reference ?? reference);
      annotations.set(ref, {
        reference: ref,
        loved: false,
        rating: null,
        note: null,
        tags: [],
        ...(annotations.get(ref) as object),
        ...Object.fromEntries(
          Object.entries(value).filter(([key]) =>
            ["loved", "rating", "note", "tags"].includes(key),
          ),
        ),
      });
      return { reference: ref, annotation: annotations.get(ref) };
    }
    return { reference, annotation: annotations.get(reference) ?? null };
  }
  if (path === "/api/v1/track") {
    const track = snapshot.tracks.find((t) => t.reference === reference);
    const recording = demoMusic.find((m) => `track:web-demo-${m.id}` === reference);
    if (track && recording)
      return {
        ...track,
        size:
          properties[reference.replace("track:web-demo-", "") as keyof typeof properties]?.size ??
          0,
        properties: properties[reference.replace("track:web-demo-", "") as keyof typeof properties],
        tags: {
          artist: [demoAuthor(recording.author).name],
          composer: [demoAuthor(recording.author).name],
          license: ["CC BY 4.0"],
          website: [recording.source],
        },
        credits: [
          {
            reference: track.artist,
            name: demoAuthor(recording.author).name,
            role: "composer",
            source: "author",
          },
        ],
        analyses: [],
      };
  }
  if (
    [
      "/api/v1/labels",
      "/api/me/v1/m3u-files",
      "/api/me/v1/m3u",
      "/api/me/v1/collections",
      "/api/me/v1/history",
      "/api/admin/v1/tasks",
    ].includes(path)
  )
    return page([]);
  throw new Error("Cette fonction n’est pas disponible dans la démonstration Web.");
}

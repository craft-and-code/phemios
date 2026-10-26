import music from "./music.json";
interface DemoRecording {
  id: string;
  title: string;
  author: string;
  album: string;
  year: number;
  genre: string;
  duration: number;
  source: string;
  file: string;
}
/** Curated recordings retain their real authors/releases; covers are original Phémios demo artwork. */
export const demoMusic: readonly DemoRecording[] = music;
export const demoAuthors = [
  { id: "scott", name: "Scott Buckley" },
  { id: "chris", name: "Chris Zabriskie" },
] as const;
/** Unknown authors are refused rather than credited to a default musician. */
export function demoAuthor(id: string) {
  const row = demoAuthors.find((author) => author.id === id);
  if (!row) throw new Error("Artiste absent de la démonstration.");
  return row;
}
export const demoAccount = {
  id: "web-demo",
  username: "Démonstration",
  role: "user",
  enabled: true,
};
export function demoSnapshot(server: string) {
  return {
    server,
    accountId: demoAccount.id,
    scannedAt: 1,
    artists: demoAuthors.map((author) => ({
      reference: `artist:web-demo-${author.id}`,
      name: author.name,
      genre: "Instrumental",
      genres: [...new Set(demoMusic.filter((m) => m.author === author.id).map((m) => m.genre))],
      country: null,
      biography:
        "Cette démonstration propose une sélection de musique instrumentale sous licence Creative Commons Attribution 4.0. Les pochettes sont des créations de Phémios ; les albums ne contiennent que les titres retenus pour cette sélection.",
      media: {},
      release_refs: demoMusic
        .filter((m) => m.author === author.id)
        .map((m) => `release:web-demo-${m.id}`),
      search_fields: [author.name],
    })),
    albums: demoMusic.map((m) => ({
      reference: `release:web-demo-${m.id}`,
      artist: `artist:web-demo-${m.author}`,
      title: m.album,
      year: m.year,
      compilation: false,
      tags: [m.genre],
      cover: true,
      track_count: 1,
      contributors: [`artist:web-demo-${m.author}`],
      composers: [{ reference: `artist:web-demo-${m.author}` }],
    })),
    tracks: demoMusic.map((m) => ({
      reference: `track:web-demo-${m.id}`,
      title: m.title,
      release: `release:web-demo-${m.id}`,
      album_title: m.album,
      artist: `artist:web-demo-${m.author}`,
      disc_no: 1,
      track_no: 1,
      album_position: 1,
      duration_ms: m.duration,
      analysis_available: false,
      spectrum_available: false,
      lyrics_available: false,
    })),
  };
}
export function demoMedia(reference: string) {
  const row = demoMusic.find((m) => `track:web-demo-${m.id}` === reference);
  if (!row) throw new Error("Titre absent de la démonstration.");
  return `${import.meta.env.BASE_URL}web-demo/audio/${row.file}`;
}
export function demoArtwork(reference: string): string | undefined {
  const row = demoMusic.find((m) => `release:web-demo-${m.id}` === reference);
  return row ? `${import.meta.env.BASE_URL}web-demo/${row.id}.svg` : undefined;
}

import type { Album } from "../library/types";
import { demoArtists } from "../demo/catalog";

/** Bundled fictional art keeps every density mode visual and fully offline. */
export function Artwork(props: { album: Album; compact?: boolean }) {
  const index = () =>
    ["blue", "islands", "edges", "dawn", "first", "lines"].indexOf(props.album.reference);
  return (
    <div
      class="artwork"
      classList={{ compact: props.compact ?? false }}
      data-palette={Math.max(0, index()) % 6}
      role="img"
      aria-label={`Pochette fictive : ${props.album.title}`}
    >
      <span>{props.album.title}</span>
      <small>{demoArtists.find((a) => a.reference === props.album.artist)?.name}</small>
    </div>
  );
}

import type { Album } from "../library/types";
import { Artwork } from "./Artwork";
import { CoverPreviewView } from "./CoverPreviewView";
import { useLibrary } from "../library/context";
/** Preview only resident artwork; opening the dialog never initiates enrichment. */
export function CoverPreview(props: { album: Album; onClose: () => void }) {
  const library = useLibrary();
  return (
    <CoverPreviewView
      title={props.album.title}
      image={library.image(props.album.reference, "cover")}
      fallback={<Artwork album={props.album} />}
      onClose={props.onClose}
    />
  );
}

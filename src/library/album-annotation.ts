import type { Album } from "./types";
import type { Annotation } from "./server";
/** Keep sourced genre tags distinct from owner annotations; personal tags remain searchable. */
export function annotateAlbum(album: Album, personal: Annotation | undefined): Album {
  return personal
    ? {
        ...album,
        searchFields: [...(album.searchFields ?? []), ...personal.tags],
        note: personal.note ?? "",
        ...(personal.rating ? { rating: personal.rating } : {}),
        favourite: personal.loved,
      }
    : album;
}

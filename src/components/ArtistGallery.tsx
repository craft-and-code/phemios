import { For, Show, createMemo } from "solid-js";
import { useLibrary } from "../library/context";
import { catalogIndex } from "../library/index";
import { artistDiscography, featuredArtistAlbums } from "../library/artist-presentation";
import type { ArtistView } from "../library/tool-preferences";
import type { Album, Artist } from "../library/types";
import { countryName } from "../i18n";
import { ArtistCard } from "./ArtistCard";
import { CoverPlay } from "./CoverPlay";
import { Artwork } from "./Artwork";
import { SourceBadge } from "./SourceBadge";
import { Icon } from "./Icon";
/** Resident art and owner-scoped annotated albums feed the three presentation surfaces. */
export function ArtistGallery(props: { artists: readonly Artist[]; view: ArtistView }) {
  const library = useLibrary();
  const index = createMemo(() => catalogIndex(library.artists(), library.albums()));
  return (
    <ul class={`artist-presentations artist-presentations-${props.view}`}>
      <For each={props.artists}>
        {(artist) => {
          const albums = createMemo(() =>
            artistDiscography(artist, index().albumsByArtist.get(artist.reference) ?? []),
          );
          const selected = createMemo(() =>
            props.view === "discography" ? featuredArtistAlbums(albums()) : albums().slice(0, 3),
          );
          const image = () =>
            library.image(artist.reference, "portrait") ??
            library.image(artist.reference, "background") ??
            library.image(artist.reference, "banner");
          const fallback = () => albums()[0];
          return (
            <li>
              <ArtistCard
                view={props.view}
                name={artist.name}
                href={`#/artist/${encodeURIComponent(artist.reference)}`}
                metadata={[artist.genre, countryName(artist.countryCode, artist.country)]
                  .filter(Boolean)
                  .join(" · ")}
                albumCount={albums().length}
                image={image()}
                logo={library.image(artist.reference, "logo")}
                badge={<SourceBadge reference={artist.reference} />}
                play={<CoverPlay reference={artist.reference} title={artist.name} />}
                fallback={
                  <Show
                    when={fallback()}
                    fallback={
                      <div class="artist-presentation-fallback">
                        <Icon name="users" />
                      </div>
                    }
                  >
                    {(album) => <Artwork album={album()} thumbnail />}
                  </Show>
                }
              >
                <div class="artist-presentation-thumbnails">
                  <For each={selected()}>
                    {(album: Album) => (
                      <div class="artist-album-preview">
                        <a
                          href={`#/album/${encodeURIComponent(album.reference)}`}
                          title={album.title}
                        >
                          <Artwork album={album} thumbnail />
                        </a>
                        <Show when={props.view === "discography"}>
                          <CoverPlay reference={album.reference} title={album.title} />
                        </Show>
                      </div>
                    )}
                  </For>
                </div>
              </ArtistCard>
            </li>
          );
        }}
      </For>
    </ul>
  );
}

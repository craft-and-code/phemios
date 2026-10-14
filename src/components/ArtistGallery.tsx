import { For, Show, createMemo, createSignal, onCleanup, onMount } from "solid-js";
import { useLibrary } from "../library/context";
import { catalogIndex } from "../library/index";
import { artistDiscography, type ArtistPositions } from "../library/artist-presentation";
import { createViewportGate } from "../library/viewport-gate";
import type { ArtistView } from "../library/tool-preferences";
import type { Album, Artist } from "../library/types";
import { countryName, t } from "../i18n";
import { ArtistCard } from "./ArtistCard";
import { CoverFlow } from "./CoverFlow";
import { CoverPlay } from "./CoverPlay";
import { Artwork } from "./Artwork";
import { SourceBadge } from "./SourceBadge";
import { Icon } from "./Icon";
/** Native adapter reuses bounded Cover Flow windows; hidden cards do not allocate an animated scene. */
export function ArtistGallery(props: {
  artists: readonly Artist[];
  view: ArtistView;
  positions: ArtistPositions;
}) {
  const library = useLibrary();
  const index = createMemo(() => catalogIndex(library.artists(), library.albums()));
  const gate = createViewportGate();
  onCleanup(() => gate.dispose());
  return (
    <ul class={`artist-presentations artist-presentations-${props.view}`}>
      <For each={props.artists}>
        {(artist) => {
          const albums = createMemo(() =>
            artistDiscography(artist, index().albumsByArtist.get(artist.reference) ?? []),
          );
          const [visible, setVisible] = createSignal(false);
          let element: HTMLLIElement | undefined;
          onMount(() => {
            if (!element) return;
            const stop = gate.watch(element, setVisible);
            onCleanup(stop);
          });
          const image = () =>
            library.image(artist.reference, "portrait") ??
            library.image(artist.reference, "background") ??
            library.image(artist.reference, "banner");
          const fallback = () => albums()[0];
          return (
            <li
              ref={(node) => {
                element = node;
              }}
            >
              <ArtistCard
                view={props.view}
                name={artist.name}
                href={`#/artist/${encodeURIComponent(artist.reference)}`}
                metadata={[artist.genre, countryName(artist.countryCode, artist.country)]
                  .filter(Boolean)
                  .join(" · ")}
                albumCount={albums().length}
                image={image()}
                banner={library.image(artist.reference, "banner")}
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
                <Show
                  when={props.view === "discography"}
                  fallback={
                    <div class="artist-presentation-thumbnails">
                      <For each={albums().slice(0, 3)}>
                        {(album: Album) => (
                          <a
                            href={`#/album/${encodeURIComponent(album.reference)}`}
                            title={album.title}
                          >
                            <Artwork album={album} thumbnail />
                          </a>
                        )}
                      </For>
                    </div>
                  }
                >
                  <Show
                    when={visible()}
                    fallback={
                      <div class="artist-carousel-placeholder" aria-label={t("Discographie")} />
                    }
                  >
                    <CoverFlow
                      albums={albums()}
                      reverse={false}
                      position={props.positions.forArtist(artist.reference)}
                    />
                  </Show>
                </Show>
              </ArtistCard>
            </li>
          );
        }}
      </For>
    </ul>
  );
}

import { createArtistLogoRecovery } from "../library/artist-logo-recovery";
import { referenceSource } from "../library/sources";
import { Feedback } from "./Feedback";
import { For, Show, createMemo, createEffect, createSignal, onMount, onCleanup } from "solid-js";
import { useLibrary } from "../library/context";
import { catalogIndex } from "../library/index";
import {
  artistDiscography,
  featuredArtistAlbums,
  artistPresentationImage,
} from "../library/artist-presentation";
import type { ArtistView } from "../library/tool-preferences";
import type { Album, Artist } from "../library/types";
import { countryName } from "../i18n";
import { ArtistCard } from "./ArtistCard";
import { CoverPlay } from "./CoverPlay";
import { Artwork } from "./Artwork";
import { SourceBadge } from "./SourceBadge";
import { Icon } from "./Icon";
/** Resident art and owner-scoped annotated albums feed the two presentation surfaces. */
export function ArtistGallery(props: { artists: readonly Artist[]; view: ArtistView }) {
  const library = useLibrary();
  const index = createMemo(() => catalogIndex(library.artists(), library.albums()));
  const scopes = createMemo(() => ({
    local: { session: library.localSession(), snapshot: library.publicSnapshot("local") },
    server: { session: library.serverSession(), snapshot: library.publicSnapshot("server") },
  }));
  const [recoveryError, setRecoveryError] = createSignal("");
  const recovery = createArtistLogoRecovery({
    enabled: () => props.view === "discography" && !library.demo,
    scope: (ref) => {
      const scope = scopes()[referenceSource(ref)];
      return scope.session ? scope : undefined;
    },
    cached: (ref) => !!library.image(ref, "logo") || !!library.imageError(ref, "logo"),
    load: (ref) => library.warmImage(ref, "logo"),
    failed: (failure) => setRecoveryError(String(failure)),
  });
  const elements = new Map<Element, string>();
  let observer: IntersectionObserver | undefined;
  onMount(() => {
    observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const ref = elements.get(entry.target);
          if (ref) recovery.visibility(ref, entry.isIntersecting);
        }
      },
      { rootMargin: "160px 0px" },
    );
    for (const element of elements.keys()) observer.observe(element);
  });
  createEffect(() => {
    scopes();
    void props.view;
    recovery.refresh();
  });
  onCleanup(() => {
    observer?.disconnect();
    recovery.dispose();
  });
  return (
    <>
      <Feedback error message={recoveryError()} />
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
              artistPresentationImage(props.view, (kind) => library.image(artist.reference, kind));
            const fallback = () => albums()[0];
            return (
              <li
                ref={(element) => {
                  if (artist.media?.logo !== undefined) return;
                  elements.set(element, artist.reference);
                  observer?.observe(element);
                  onCleanup(() => {
                    observer?.unobserve(element);
                    elements.delete(element);
                    recovery.visibility(artist.reference, false);
                  });
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
                  logo={library.image(artist.reference, "logo")}
                  badge={<SourceBadge reference={artist.reference} />}
                  play={
                    <CoverPlay reference={artist.reference} title={artist.name} append="badge" />
                  }
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
                          <CoverPlay reference={album.reference} title={album.title} />
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
    </>
  );
}

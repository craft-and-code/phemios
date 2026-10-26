import { RefreshButton } from "./RefreshButton";
import { createSignal, Show, onMount, onCleanup } from "solid-js";
import { t } from "../i18n";
import type { MissingAlbum } from "../library/missing";
import { useLibrary } from "../library/context";
import { SourceBadge } from "./SourceBadge";
import { Icon } from "./Icon";
/** No cover is invented for unowned albums; a reduced cover preserves the distinction. */
export function MissingAlbumCard(props: { album: MissingAlbum }) {
  const library = useLibrary(),
    [busy, setBusy] = createSignal(false),
    [error, setError] = createSignal("");
  let tile: HTMLDivElement | undefined;
  let observer: IntersectionObserver | undefined;
  onMount(() => {
    observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          observer?.disconnect();
          void library.missingArtwork.load(props.album);
        }
      },
      { rootMargin: "240px" },
    );
    if (tile) observer.observe(tile);
  });
  onCleanup(() => observer?.disconnect());
  return (
    <div
      class="album-card missing-album"
      ref={(element) => {
        tile = element;
      }}
    >
      <div class="missing-cover">
        <div class="artwork real-art missing-release-art">
          <Show when={library.missingArtwork.image(props.album)} fallback={<Icon name="disc" />}>
            {(url) => (
              <img
                src={url()}
                alt={t("Pochette : {0}", props.album.title)}
                title="Cover Art Archive · MusicBrainz"
                decoding="async"
              />
            )}
          </Show>
          <span class="missing-mark">
            <Icon name="missing" />
            {t("Manquant")}
          </span>
        </div>

        <button
          class="icon-button missing-dismiss"
          title={t("Masquer cette suggestion")}
          aria-label={t("Masquer {0} des albums manquants", props.album.title)}
          disabled={
            busy() ||
            library.sessionFor(props.album.artist)?.account.role === "auditor" ||
            !library.sessionFor(props.album.artist)
          }
          onClick={async () => {
            setBusy(true);
            setError("");
            try {
              await library.missing.decide(props.album, true);
            } catch (failure) {
              setError(failure instanceof Error ? failure.message : String(failure));
            } finally {
              setBusy(false);
            }
          }}
        >
          <Icon name="close" />
        </button>
        <Show
          when={["failed", "absent", "loading", "cancelled"].includes(
            library.missingArtwork.status(props.album),
          )}
        >
          <RefreshButton
            identity={library.sessionFor(props.album.artist)}
            class="missing-cover-retry"
            label={t("Réessayer les pochettes")}
            busy={library.missingArtwork.status(props.album) === "loading"}
            onCancel={() => library.missingArtwork.cancel([props.album])}
            onRefresh={(event) => {
              event.preventDefault();
              event.stopPropagation();
              return library.missingArtwork.load(props.album, true);
            }}
          />
        </Show>
      </div>
      <div class="missing-album-title">
        <strong>{props.album.title}</strong>
        <small>
          {props.album.artist_name} · {props.album.year ?? t("Année inconnue")}{" "}
          <SourceBadge reference={props.album.artist} />
        </small>
      </div>
      <Show when={error()}>
        <small role="alert">{error()}</small>
      </Show>
    </div>
  );
}

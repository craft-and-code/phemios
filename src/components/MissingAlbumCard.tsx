import { createSignal, Show } from "solid-js";
import { t } from "../i18n";
import type { MissingAlbum } from "../library/missing";
import { useLibrary } from "../library/context";
import { SourceBadge } from "./SourceBadge";
import { Icon } from "./Icon";
/** No cover is invented for unowned albums; an explicit neutral faded tile preserves the distinction. */
export function MissingAlbumCard(props: { album: MissingAlbum }) {
  const library = useLibrary(),
    [busy, setBusy] = createSignal(false),
    [error, setError] = createSignal("");
  return (
    <div class="album-card missing-album">
      <a
        href={`#/artist/${encodeURIComponent(props.album.artist)}`}
        title={t("Ouvrir l’artiste {0}", props.album.artist_name)}
      >
        <div class="artwork real-art missing-release-art">
          <Icon name="disc" />
          <span class="missing-mark">
            <Icon name="missing" />
            {t("Manquant")}
          </span>
        </div>
        <strong>{props.album.title}</strong>
        <small>
          {props.album.artist_name} · {props.album.year ?? t("Année inconnue")}{" "}
          <SourceBadge reference={props.album.artist} />
        </small>
      </a>
      <div class="missing-actions">
        <a href={props.album.url} target="_blank" rel="noreferrer">
          MusicBrainz
        </a>
        <button
          class="icon-button quiet"
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
              setError(String(failure));
            } finally {
              setBusy(false);
            }
          }}
        >
          <Icon name="eye-off" />
        </button>
      </div>
      <Show when={error()}>
        <small role="alert">{error()}</small>
      </Show>
    </div>
  );
}

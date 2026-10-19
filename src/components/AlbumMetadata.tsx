import { createCatalogDetail } from "../library/catalog-detail";
import { For, Show } from "solid-js";
import { t, countryName } from "../i18n";
import { albumLabels } from "../library/album-metadata";
import { useLibrary } from "../library/context";
import type { Album, Artist } from "../library/types";
/** Edition genres/labels and the principal artist's country remain separate sourced facts. */
export function AlbumMetadata(props: {
  album: Album;
  artist: Artist | undefined;
  onGenres: (genres: readonly string[]) => void;
  onCountry: (country: string) => void;
}) {
  const library = useLibrary();
  const owner = () => library.sessionFor(props.album.reference);
  const labels = createCatalogDetail(
    () => props.album.reference,
    owner,
    (reference, session, admission) =>
      albumLabels(reference, { owner: session, current: admission.current }),
  );
  const rows = labels.current;
  return (
    <div class="album-metadata">
      <div>
        <small>{t("Pays")}</small>
        <Show
          when={props.artist?.country}
          fallback={<span class="muted">{t("Origine inconnue")}</span>}
        >
          {(country) => (
            <button class="metadata-link" onClick={() => props.onCountry(country())}>
              {countryName(props.artist?.countryCode, country())}
            </button>
          )}
        </Show>
      </div>
      <div>
        <small>{t("Genres")}</small>
        <Show
          when={props.album.tags.length}
          fallback={<span class="muted">{t("Non renseigné")}</span>}
        >
          <For each={props.album.tags}>
            {(genre, index) => (
              <>
                <Show when={index()}> · </Show>
                <button class="metadata-link" onClick={() => props.onGenres(props.album.tags)}>
                  {genre}
                </button>
              </>
            )}
          </For>
        </Show>
      </div>
      <div>
        <small>{t("Labels")}</small>
        <Show
          when={!labels.loading()}
          fallback={<span class="spinner" aria-label={t("Chargement…")} />}
        >
          <Show
            when={!owner() || !labels.error()}
            fallback={
              <span role="alert" class="metadata-error">
                {String(labels.error())}
              </span>
            }
          >
            <Show
              when={rows()?.length}
              fallback={
                <span class="muted">
                  {library.sessionFor(props.album.reference)
                    ? t("Non renseigné")
                    : t("Connectez Aède pour consulter les labels.")}
                </span>
              }
            >
              <For each={rows()}>
                {(label, index) => (
                  <>
                    <Show when={index()}> · </Show>
                    <a
                      class="metadata-link"
                      href={`#/label/${encodeURIComponent(label.reference)}`}
                    >
                      {label.name}
                    </a>
                  </>
                )}
              </For>
            </Show>
          </Show>
        </Show>
      </div>
    </div>
  );
}

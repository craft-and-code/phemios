import { createResource, For, Show } from "solid-js";
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
  const owner = () => {
    const session = library.sessionFor(props.album.reference);
    return session
      ? JSON.stringify([props.album.reference, session.server, session.account.id])
      : false;
  };
  const [labels] = createResource(owner, async (key) => ({
    key,
    rows: await albumLabels((JSON.parse(key) as string[])[0]!),
  }));
  const rows = () => (owner() && labels()?.key === owner() ? labels()?.rows : undefined);
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
          when={!labels.loading}
          fallback={<span class="spinner" aria-label={t("Chargement…")} />}
        >
          <Show
            when={!owner() || !labels.error}
            fallback={
              <span role="alert" class="metadata-error">
                {String(labels.error)}
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

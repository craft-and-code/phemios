import { createMemo, createResource, For, Show } from "solid-js";
import { t } from "../i18n";
import { useLibrary } from "../library/context";
import { normalizeName } from "../library/filtering";
import { tagCatalog, taggedEntries, taggedTrackWindow } from "../library/tag-catalog";
import { parseTrackDetail } from "../library/track-detail";
import { requestAede } from "../platform/desktop";
import { AlbumGrid } from "../components/AlbumGrid";
import { SourceBadge } from "../components/SourceBadge";
import { TrackResults } from "../components/TrackResults";
/** Personal tags join the two signed-in owners without copying tags into audio metadata. */
export function TagsPage(props: {
  query: string;
  selected: string;
  onSelect: (tag: string) => void;
  offset: number;
  setOffset: (offset: number) => void;
}) {
  const library = useLibrary();
  const annotations = () => Object.values(library.annotations);
  const vocabulary = createMemo(() => tagCatalog(annotations()));
  const visibleTags = () =>
    vocabulary().filter((tag) => normalizeName(tag.label).includes(normalizeName(props.query)));
  const entries = createMemo(() => taggedEntries(annotations(), props.selected, props.query));
  const references = createMemo(() => new Set(entries().map((row) => row.reference)));
  const artists = () => library.artists().filter((row) => references().has(row.reference));
  const albums = () => library.albums().filter((row) => references().has(row.reference));
  const tracks = createMemo(() =>
    entries()
      .filter((row) => row.reference.startsWith("track:"))
      .map((row) => row.reference),
  );
  const offset = () =>
    Math.min(props.offset, Math.max(0, Math.ceil(tracks().length / 10) - 1) * 10);
  const unresolved = () => entries().length - artists().length - albums().length - tracks().length;
  const [details, { refetch }] = createResource(
    () => ({
      references: tracks(),
      offset: offset(),
      local: library.localSession(),
      server: library.serverSession(),
    }),
    (key) =>
      taggedTrackWindow(key.references, key.offset, async (reference) => {
        const session = library.sessionFor(reference);
        if (!session) throw new Error(t("Connectez Aède pour consulter ce titre."));
        const detail = parseTrackDetail(
          await requestAede("/api/v1/track", { ref: reference }),
          reference,
        );
        if (session !== library.sessionFor(reference)) throw new Error(t("Session invalide."));
        return detail;
      }),
  );
  return (
    <section class="page tags-page">
      <Show when={!library.localSession() && !library.serverSession()}>
        <p class="notice">{t("Connectez-vous pour accéder aux données de votre compte.")}</p>
      </Show>
      <p class="muted">{t("Tags personnels enregistrés sur vos artistes, albums et pistes.")}</p>
      <div class="tag-choices" aria-label={t("Choisir un tag")}>
        <button aria-pressed={!props.selected} onClick={() => props.onSelect("")}>
          {t("Tous les tags")}
        </button>
        <For each={visibleTags()}>
          {(tag) => (
            <button
              aria-pressed={props.selected === tag.key}
              onClick={() => props.onSelect(props.selected === tag.key ? "" : tag.key)}
            >
              {tag.label}
              <span class="tag-count">{tag.count}</span>
            </button>
          )}
        </For>
      </div>
      <Show when={!entries().length}>
        <p class="empty">{t("Aucun élément tagué dans cette sélection.")}</p>
      </Show>
      <Show when={artists().length}>
        <section>
          <h2>{t("Artistes")}</h2>
          <ul class="personal-list tagged-artists">
            <For each={artists()}>
              {(artist) => (
                <li>
                  <a href={`#/artist/${encodeURIComponent(artist.reference)}`}>{artist.name}</a>
                  <SourceBadge reference={artist.reference} />
                </li>
              )}
            </For>
          </ul>
        </section>
      </Show>
      <Show when={albums().length}>
        <section>
          <h2>{t("Albums")}</h2>
          <AlbumGrid albums={albums()} />
        </section>
      </Show>
      <Show when={tracks().length}>
        <section>
          <div class="section-heading">
            <h2>{t("Pistes")}</h2>
            <div class="page-controls">
              <button
                disabled={!offset()}
                onClick={() => props.setOffset(Math.max(0, offset() - 10))}
              >
                {t("Précédentes")}
              </button>
              <span>
                {offset() + 1}–{Math.min(offset() + 10, tracks().length)} / {tracks().length}
              </span>
              <button
                disabled={offset() + 10 >= tracks().length}
                onClick={() => props.setOffset(offset() + 10)}
              >
                {t("Suivantes")}
              </button>
            </div>
          </div>
          <Show when={details.loading}>
            <p role="status">{t("Chargement des pistes…")}</p>
          </Show>
          <Show when={details.error}>
            <p role="alert">{String(details.error)}</p>
            <button onClick={() => refetch()}>{t("Réessayer")}</button>
          </Show>
          <Show when={!details.loading && !details.error}>
            <ol class="track-list">
              <For each={details()}>
                {(row, index) => (
                  <Show
                    when={"track" in row ? row.track : undefined}
                    fallback={
                      <li class="tagged-unavailable">
                        <a href={`#/track/${encodeURIComponent(row.reference)}`}>
                          {t("Titre indisponible")}
                        </a>
                        <SourceBadge reference={row.reference} />
                        <p role="alert">{"error" in row ? row.error : ""}</p>
                        <button onClick={() => refetch()}>{t("Réessayer")}</button>
                      </li>
                    }
                  >
                    {(track) => (
                      <TrackResults
                        track={track()}
                        number={offset() + index() + 1}
                        origin
                        onPlay={() => void library.player.startReference(row.reference)}
                        context={
                          <Show when={track().release}>
                            {(reference) => (
                              <a href={`#/album/${encodeURIComponent(reference())}`}>
                                {library.albums().find((album) => album.reference === reference())
                                  ?.title ?? t("Album")}
                              </a>
                            )}
                          </Show>
                        }
                      />
                    )}
                  </Show>
                )}
              </For>
            </ol>
          </Show>
        </section>
      </Show>
      <Show when={unresolved() > 0}>
        <p class="notice">
          {t(
            "{0} élément(s) tagué(s) absent(s) du catalogue en cache. Synchronisez la bibliothèque pour les retrouver.",
            unresolved(),
          )}
        </p>
      </Show>
    </section>
  );
}

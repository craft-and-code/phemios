import { StickyHeader } from "../components/StickyHeader";
import { BiographyText } from "../components/BiographyText";
import { createResource, createSignal, createEffect, onCleanup, Show } from "solid-js";
import { t } from "../i18n";
import { useLibrary } from "../library/context";
import { requestAede } from "../platform/desktop";
import { parseLabelDetail } from "../library/labels";
import { sourceLink } from "../library/server";
import { FilterBar } from "../components/FilterBar";
import { SelectionCollection } from "../components/SelectionCollection";
import { Icon } from "../components/Icon";
import { filterAlbums } from "../library/filtering";
import { labelExpression, labelHistogram, labelYearDomain } from "../library/label-browsing";
import { referenceSource } from "../library/sources";
import type { Filters } from "../library/types";
import { AlbumGrid } from "../components/AlbumGrid";
import { SourceBadge } from "../components/SourceBadge";
/** Attributed label biography precedes its owned albums, with explicit missing-cache feedback. */
export function LabelPage(props: {
  reference: string;
  onTitle: (name: string) => void;
  compact: boolean;
  onCompact: () => void;
}) {
  const library = useLibrary();
  let alive = true;
  onCleanup(() => {
    alive = false;
  });
  const [result] = createResource(
    () => ({
      reference: props.reference,
      session: library.sessionFor(props.reference),
      catalog: library.albums(),
    }),
    async (key) => {
      if (!key.session)
        return {
          error: t("Connectez-vous pour accéder aux données de votre compte."),
          session: key.session,
        };
      try {
        const detail = parseLabelDetail(
          await requestAede("/api/v1/label", { ref: key.reference }),
          key.reference,
        );
        if (!alive || key.session !== library.sessionFor(key.reference))
          throw new Error(t("Session invalide."));
        props.onTitle(detail.name);
        return { detail, session: key.session };
      } catch (failure) {
        return { error: String(failure), session: key.session };
      }
    },
  );
  const current = () =>
    result()?.session === library.sessionFor(props.reference) ? result() : undefined;
  const detail = () => current()?.detail;
  const albums = () =>
    library.albums().filter((album) => detail()?.releases.includes(album.reference));
  const [filters, setFilters] = createSignal<Filters>({
      mode: "years",
      years: [0, 0],
      alphabet: [0, 26],
      includeUnknownYear: true,
      query: "",
    }),
    [reverse, setReverse] = createSignal(false);
  let initialized = false;
  createEffect(() => {
    if (detail() && !initialized && (albums().length || !detail()?.releases.length)) {
      initialized = true;
      setFilters({ ...filters(), years: labelYearDomain(albums()) });
    }
  });
  const selected = () => filterAlbums(albums(), library.artists(), filters());
  return (
    <article class="label-page">
      <Show when={result.loading}>
        <p class="page" role="status">
          {t("Chargement…")}
        </p>
      </Show>
      <Show when={current()?.error}>
        <p class="page notice" role="alert">
          {current()?.error}
        </p>
      </Show>
      <Show when={detail()}>
        {(row) => (
          <>
            <header class="artist-hero">
              <div>
                <p class="eyebrow">{t("LABEL")}</p>
                <div class="detail-title">
                  <h1>{row().name}</h1>
                  <SourceBadge reference={props.reference} />
                </div>
              </div>
            </header>
            <div class="page">
              <section class="biography">
                <h2>{t("Biographie")}</h2>
                <p class="label-biography">
                  <BiographyText
                    reference={props.reference}
                    text={row().biography?.text || t("Aucune biographie récupérée pour ce label.")}
                  />
                </p>
                <Show when={row().biography}>
                  {(prose) => (
                    <small>
                      <Show when={sourceLink(prose().url)} fallback={prose().url}>
                        {(url) => (
                          <a href={url()} target="_blank" rel="noreferrer">
                            {prose().source === "discogs"
                              ? "Data provided by Discogs."
                              : t("Source de la biographie")}
                          </a>
                        )}
                      </Show>{" "}
                      · {prose().source} · {prose().lang} · {prose().licence}
                    </small>
                  )}
                </Show>
              </section>
              <h2>{t("Albums")}</h2>
              <StickyHeader>
                <FilterBar
                  yearDomain={labelYearDomain(albums())}
                  value={filters()}
                  setValue={setFilters}
                  context={t("Initiale du titre · année de l’album")}
                  histogram={labelHistogram(albums(), library.artists(), filters())}
                  countLabel={t("albums")}
                  resultCount={selected().length}
                  hasUnknownYear={albums().some((album) => album.year === null)}
                />
                <div class="label-toolbar">
                  <button
                    class="icon-button"
                    aria-label={t("Inverser le tri")}
                    title={t("Inverser le tri")}
                    aria-pressed={reverse()}
                    onClick={() => setReverse(!reverse())}
                  >
                    <Icon name="sort" />
                  </button>
                  <button
                    class="icon-button"
                    aria-label={t("Vue compacte")}
                    title={t("Vue compacte")}
                    aria-pressed={props.compact}
                    onClick={props.onCompact}
                  >
                    <Icon name="layers" />
                  </button>
                  <SelectionCollection
                    expression={labelExpression(props.reference, filters())}
                    source={referenceSource(props.reference)}
                    disabled={!selected().length}
                  />
                </div>
              </StickyHeader>
              <AlbumGrid albums={selected()} reverse={reverse()} chronological emptyIcon="label" />
              <Show when={row().releases.length > albums().length}>
                <p class="notice">
                  {t(
                    "Certains albums de ce label sont absents du cache. Synchronisez la bibliothèque.",
                  )}
                </p>
              </Show>
            </div>
          </>
        )}
      </Show>
    </article>
  );
}

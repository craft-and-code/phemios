import { createLabelSelection } from "../library/label-selection";
import { BiographyMore } from "../components/BiographyMore";
import type { BiographyNavigation } from "../library/biography-navigation";
import { ArtistBiography } from "../components/ArtistBiography";
import { createBiographyReading } from "../library/biography-reading-state";
import {
  downloadEncyclopedia,
  readEncyclopediaTitle,
  readCachedBiography,
  isNative,
} from "../platform/desktop";
import { Feedback } from "../components/Feedback";
import { PageLoader } from "../components/PageLoader";
import { StickyHeader } from "../components/StickyHeader";
import { BiographyText } from "../components/BiographyText";
import { createResource, createEffect, on, onCleanup, Show } from "solid-js";
import { t } from "../i18n";
import { useLibrary } from "../library/context";
import { requestAede } from "../platform/desktop";
import { parseLabelDetail, type LabelDetail } from "../library/labels";
import { sourceLink, type AccountSession, type Snapshot } from "../library/server";
import { FilterBar } from "../components/FilterBar";
import { SelectionCollection } from "../components/SelectionCollection";
import { Icon } from "../components/Icon";
import { filterAlbums } from "../library/filtering";
import { labelExpression, labelHistogram, labelYearDomain } from "../library/label-browsing";
import { referenceSource } from "../library/sources";
import { AlbumGrid } from "../components/AlbumGrid";
import { SourceBadge } from "../components/SourceBadge";
interface LabelResult {
  reference: string;
  session: AccountSession | undefined;
  snapshot: Snapshot | undefined;
  detail?: LabelDetail;
  error?: string;
}

/** Attributed label biography precedes its owned albums, with explicit missing-cache feedback. */
export function LabelPage(props: {
  reference: string;
  onTitle: (name: string) => void;
  compact: boolean;
  onBiographyNavigation: BiographyNavigation;
  onCompact: () => void;
}) {
  const library = useLibrary();
  let alive = true;
  onCleanup(() => {
    alive = false;
  });
  const source = () => referenceSource(props.reference);
  const [result] = createResource(
    () => ({
      reference: props.reference,
      session: library.sessionFor(props.reference),
      snapshot: library.publicSnapshot(source()),
    }),
    async (key): Promise<LabelResult> => {
      const cached =
        !key.session || key.session.server === key.snapshot?.server
          ? key.snapshot?.labels?.find((row) => row.reference === key.reference)
          : undefined;
      const current = () =>
        alive &&
        key.reference === props.reference &&
        key.session === library.sessionFor(key.reference) &&
        key.snapshot === library.publicSnapshot(referenceSource(key.reference));
      try {
        let detail: LabelDetail | undefined = cached;
        if (key.session) {
          let raw: unknown;
          try {
            raw = await requestAede(
              "/api/v1/label",
              { ref: key.reference },
              "GET",
              null,
              referenceSource(key.reference),
              key.session,
            );
          } catch (failure) {
            if (!cached) throw failure;
          }
          if (raw !== undefined) detail = parseLabelDetail(raw, key.reference);
        }
        if (!detail)
          throw new Error(
            t("Ce label n’est pas encore enregistré dans ce cache. Synchronisez la bibliothèque."),
          );
        if (!current()) return { ...key };
        props.onTitle(detail.name);
        return { ...key, detail };
      } catch (failure) {
        return { ...key, error: String(failure) };
      }
    },
  );
  const current = () => {
    const value = result();
    return value?.reference === props.reference &&
      value.session === library.sessionFor(props.reference) &&
      value.snapshot === library.publicSnapshot(source())
      ? value
      : undefined;
  };
  const detail = () => current()?.detail;
  const biography = createBiographyReading(
    () => {
      const credit = detail()?.biography;
      return { reference: props.reference, ...(credit ? { biographyCredit: credit } : {}) };
    },
    readEncyclopediaTitle,
    readCachedBiography,
  );
  createEffect(() =>
    props.onBiographyNavigation(
      biography.reading() ? { label: detail()?.name ?? "", back: biography.back } : undefined,
    ),
  );
  createEffect(
    on(
      () => !!biography.reading(),
      (reading) => {
        if (reading) document.getElementById("content")?.scrollTo({ top: 0 });
      },
    ),
  );
  onCleanup(() => props.onBiographyNavigation(undefined));
  const albums = () =>
    library.albums().filter((album) => detail()?.releases.includes(album.reference));
  const { filters, setFilters, reverse, setReverse } = createLabelSelection(
    () => ({ reference: props.reference, session: library.sessionFor(props.reference) }),
    albums,
    () => !!detail() && (!!albums().length || !detail()?.releases.length),
  );
  const selected = () => filterAlbums(albums(), library.artists(), filters());
  return (
    <Show
      when={biography.reading()}
      fallback={
        <article class="label-page">
          <Show when={result.loading}>
            <PageLoader />
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
                        text={
                          row().biography?.text || t("Aucune biographie récupérée pour ce label.")
                        }
                      />
                      <Show when={biography.target()}>
                        <BiographyMore
                          busy={biography.busy()}
                          disabled={!isNative()}
                          onOpen={() => {
                            if (isNative()) void biography.open();
                          }}
                        />
                      </Show>
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

                    <Feedback error message={biography.error()} onClose={biography.clearError} />
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
                  <AlbumGrid
                    compact={props.compact}
                    albums={selected()}
                    reverse={reverse()}
                    chronological
                    emptyIcon="label"
                  />
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
      }
    >
      {(article) => (
        <ArtistBiography
          article={article()}
          onDownload={isNative() ? downloadEncyclopedia : undefined}
          artist={detail()?.name ?? ""}
          photos={[]}
          error={biography.error()}
          onDismissError={biography.clearError}
        />
      )}
    </Show>
  );
}

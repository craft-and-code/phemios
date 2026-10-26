import { useViewSession } from "../navigation/ViewSession";
import { createToolPreferences } from "../library/tool-preferences";
import { AnalysisImport } from "../components/AnalysisImport";
import { AnalysisDocument } from "../analysis-report/AnalysisDocument";
import { locale } from "../i18n";
import { Pagination } from "../components/Pagination";
import { RefreshButton } from "../components/RefreshButton";
import { createDiagnosticRead } from "../library/diagnostic-read";
import { StickyHeader } from "../components/StickyHeader";
import { AccountNotice } from "../components/AccountNotice";
import { PageLoader } from "../components/PageLoader";
import { IntegrityStatus } from "../components/IntegrityStatus";
import { Feedback } from "../components/Feedback";
import { nextCoverageSort, type CoverageColumn } from "../library/coverage-sort";
import { activeReleaseJob } from "../library/jobs";
import { createEffect, createSignal, For, Show } from "solid-js";
import { t } from "../i18n";
import { useLibrary } from "../library/context";
import { requestAede } from "../platform/desktop";
import { parseCoverage } from "../library/analysis-coverage";
import { EmptyState } from "../components/EmptyState";
import { JobControls } from "../components/JobControls";
import { AnalysisDownload } from "../components/AnalysisDownload";
import { Icon } from "../components/Icon";
import { Artwork } from "../components/Artwork";
import { CoverPlay } from "../components/CoverPlay";
/** Retained-result coverage is read separately from explicit acquisition and recomputation jobs. */
export function AnalysisPage(props: { query: string }) {
  const settings = createToolPreferences();
  const library = useLibrary(),
    [imported, setImported] = createSignal<unknown[]>(),
    [sort, setSort] = useViewSession().control("analysisSort"),
    [offset, setOffset] = createSignal(0),
    [selected, setSelected] = createSignal(""),
    [notice, setNotice] = createSignal({ message: "", failure: false });
  createEffect(() => {
    void library.session();
    void library.source();
    void props.query;
    setOffset(0);
    setSelected("");
    setNotice({ message: "", failure: false });
  });
  const read = createDiagnosticRead(
    () =>
      library.session() && !imported()
        ? {
            session: library.session(),
            source: library.source(),
            offset: offset(),
            sort: sort(),
            query: props.query,
            completed: library.tasks
              .jobs()
              .filter((job) => job.status === "completed")
              .map((job) => job.task_id)
              .join(","),
            epoch: library.trackSources().find((row) => row.source === library.source())?.scannedAt,
          }
        : false,
    async (key, admission) => {
      const status = await requestAede<{ capabilities?: string[] }>(
        "/api/v1/status",
        {},
        "GET",
        null,
        key.source,
      );
      if (!admission.current()) return undefined;
      if (!status.capabilities?.includes("analysis_coverage"))
        throw Error(
          t("Mettez à jour puis redémarrez Aède pour afficher la couverture des analyses."),
        );
      if (key.sort.column === "integrity" && !status.capabilities?.includes("analysis_integrity"))
        throw Error(t("Mettez à jour puis redémarrez Aède pour trier les analyses."));
      if (!status.capabilities?.includes("analysis_coverage_sort"))
        throw Error(t("Mettez à jour puis redémarrez Aède pour trier les analyses."));
      const data = parseCoverage(
        await requestAede(
          "/api/v1/presentation/analysis",
          {
            offset: String(key.offset),
            limit: "50",
            q: key.query,
            sort: key.sort.column,
            direction: key.sort.direction,
          },
          "GET",
          null,
          key.source,
        ),
        key.offset,
        key.epoch,
      );
      return { ...key, data };
    },
  );
  const report = read.current,
    refetch = read.refetch;
  const page = () =>
    report()?.session === library.session() && report()?.source === library.source()
      ? report()?.data
      : undefined;
  return (
    <section class="page result-page analysis-page">
      <StickyHeader>
        <div class="page-heading">
          <span>
            {t(
              imported()
                ? "Analyse importée · lecture seule"
                : "Résultats enregistrés · état du dernier catalogue",
            )}
          </span>
          <div class="analysis-page-actions">
            <AnalysisImport
              onImport={(files) => {
                read.cancel();
                setImported(files);
                setNotice({ message: "", failure: false });
              }}
              onError={(message) => setNotice({ message, failure: true })}
            />
            <Show when={!imported()}>
              <RefreshButton
                identity={library.session()}
                busy={read.loading()}
                disabled={!library.session() || (read.pending() && !read.loading())}
                onCancel={read.cancel}
                onRefresh={read.refetch}
              />
            </Show>
            <Show when={imported()}>
              <button
                type="button"
                class="back analysis-import-back"
                onClick={() => setImported(undefined)}
              >
                <Icon name="back" />
                {t("Retour aux analyses du catalogue")}
              </button>
            </Show>
          </div>
        </div>
      </StickyHeader>
      <Show when={settings.error()}>
        <Feedback error persistent message={settings.error()} />
      </Show>
      <Show when={notice().message}>
        <Feedback
          message={notice().message}
          error={notice().failure}
          onClose={() => setNotice({ message: "", failure: false })}
        />
      </Show>
      <Show
        when={imported()}
        fallback={
          <>
            <AccountNotice administrator />
            <Show when={!library.session()}>
              <EmptyState icon="wave">
                {t("Aucun élément enregistré dans cette rubrique.")}
              </EmptyState>
            </Show>
            <Show when={read.loading() && !page()}>
              <PageLoader inline />
            </Show>
            <Show when={read.error()}>
              <div class="missing-notice">
                <Feedback error persistent message={String(read.error())} />
                <RefreshButton
                  identity={library.session()}
                  busy={read.loading()}
                  disabled={read.pending() && !read.loading()}
                  onCancel={read.cancel}
                  onRefresh={refetch}
                />
              </div>
            </Show>
            <Show when={page()}>
              {(value) => (
                <>
                  <h2>{t("Votre collection")}</h2>
                  <div class="stat-tiles">
                    <For
                      each={[
                        [t("Fichiers"), value().summary.files],
                        [t("Analyses présentes"), value().summary.current],
                        [t("Analyses manquantes"), value().summary.missing],
                        [t("Analyses périmées"), value().summary.stale],
                        [t("Analyses en échec"), value().summary.failed],
                      ]}
                    >
                      {(tile) => (
                        <div>
                          <span>{tile[0]}</span>
                          <strong>{tile[1]}</strong>
                        </div>
                      )}
                    </For>
                  </div>
                  <Show
                    when={value().items.length}
                    fallback={
                      <EmptyState icon="wave">{t("Aucun album dans cette sélection.")}</EmptyState>
                    }
                  >
                    <div class="analysis-table-wrap">
                      <table class="analysis-table">
                        <thead>
                          <tr>
                            <For
                              each={
                                [
                                  ["title", "Album"],
                                  ["current", "Présentes"],
                                  ["missing", "Manquantes"],
                                  ["stale", "Périmées"],
                                  ["failed", "Échecs"],
                                  ["spectra", "Spectres"],
                                  ["integrity", "MD5 / CRC"],
                                ] as const
                              }
                            >
                              {([column, label]) => (
                                <th
                                  aria-sort={
                                    sort().column === column
                                      ? sort().direction === "asc"
                                        ? "ascending"
                                        : "descending"
                                      : "none"
                                  }
                                >
                                  <button
                                    class="coverage-sort"
                                    onClick={() => {
                                      setOffset(0);
                                      setSort(nextCoverageSort(sort(), column as CoverageColumn));
                                    }}
                                  >
                                    {t(label)}
                                    <Show when={sort().column === column}>
                                      <Icon
                                        name={
                                          sort().direction === "asc" ? "chevron-up" : "chevron-down"
                                        }
                                      />
                                    </Show>
                                  </button>
                                </th>
                              )}
                            </For>
                            <th>{t("Actions")}</th>
                          </tr>
                        </thead>
                        <tbody>
                          <For each={value().items}>
                            {(row) => (
                              <>
                                <tr class="coverage-row">
                                  <td>
                                    <div class="coverage-album">
                                      <a
                                        class="coverage-cover"
                                        href={`#/album/${encodeURIComponent(row.reference)}`}
                                        aria-label={row.title}
                                      >
                                        <Show
                                          when={library
                                            .albums()
                                            .find((album) => album.reference === row.reference)}
                                          fallback={
                                            <div class="artwork missing-art">
                                              <Icon name="disc" />
                                            </div>
                                          }
                                        >
                                          {(album) => <Artwork album={album()} thumbnail />}
                                        </Show>
                                      </a>
                                      <div class="coverage-title">
                                        <a
                                          href={`#/album/${encodeURIComponent(row.reference)}`}
                                          title={row.title}
                                        >
                                          {row.title}
                                        </a>
                                        <small title={row.artist ?? t("Artistes divers")}>
                                          {row.artist ?? t("Artistes divers")}
                                        </small>
                                      </div>
                                    </div>
                                  </td>
                                  <td>
                                    {row.current}/{row.tracks}
                                  </td>
                                  <td>{row.missing}</td>
                                  <td classList={{ "coverage-warning": row.stale > 0 }}>
                                    {row.stale}
                                  </td>
                                  <td classList={{ "coverage-warning": row.failed > 0 }}>
                                    {row.failed}
                                  </td>
                                  <td>
                                    {row.spectra}/{row.tracks}
                                  </td>
                                  <td>
                                    <IntegrityStatus value={row.integrity} />
                                  </td>
                                  <td>
                                    <div class="coverage-actions">
                                      <button
                                        class="icon-button quiet"
                                        aria-label={t("Gérer les analyses de {0}", row.title)}
                                        aria-expanded={selected() === row.reference}
                                        title={t("Gérer les analyses de {0}", row.title)}
                                        onClick={() =>
                                          setSelected(
                                            selected() === row.reference ? "" : row.reference,
                                          )
                                        }
                                      >
                                        <Show
                                          when={activeReleaseJob(
                                            library.tasks.jobs(),
                                            row.reference,
                                          )}
                                          fallback={<Icon name="wave" />}
                                        >
                                          <span class="spinner" aria-hidden="true" />
                                        </Show>
                                      </button>
                                      <Show when={row.current === row.tracks && row.tracks > 0}>
                                        <AnalysisDownload
                                          reference={row.reference}
                                          album
                                          available
                                          onStatus={(message, failure) =>
                                            setNotice({ message, failure })
                                          }
                                        />
                                      </Show>
                                      <CoverPlay
                                        reference={row.reference}
                                        title={row.title}
                                        append
                                      />
                                    </div>
                                  </td>
                                </tr>
                                <Show when={selected() === row.reference}>
                                  <tr class="analysis-expanded">
                                    <td colSpan={8}>
                                      <p class="muted">
                                        {t(
                                          "Les analyses actuelles sont réutilisées. Le recalcul doit être demandé explicitement.",
                                        )}
                                      </p>
                                      <JobControls release={row.reference} coverage={row} />
                                    </td>
                                  </tr>
                                </Show>
                              </>
                            )}
                          </For>
                        </tbody>
                      </table>
                    </div>
                  </Show>
                  <Show when={value().total > 50}>
                    <Pagination
                      offset={offset()}
                      size={50}
                      total={value().total}
                      count={value().items.length}
                      busy={read.pending()}
                      onOffset={setOffset}
                    />
                  </Show>
                </>
              )}
            </Show>
          </>
        }
      >
        {(files) => (
          <AnalysisDocument
            files={files()}
            locale={locale()}
            translate={t}
            sections={settings.value().analysisSections}
            onSectionsChange={(analysisSections) => settings.update({ analysisSections })}
          />
        )}
      </Show>
    </section>
  );
}

import { Feedback } from "../components/Feedback";
import {
  initialCoverageSort,
  nextCoverageSort,
  type CoverageColumn,
} from "../library/coverage-sort";
import { activeReleaseJob } from "../library/jobs";
import { createEffect, createResource, createSignal, For, Show } from "solid-js";
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
  const library = useLibrary(),
    [sort, setSort] = createSignal(initialCoverageSort),
    [offset, setOffset] = createSignal(0),
    [revision, setRevision] = createSignal(0),
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
  const [report, { refetch }] = createResource(
    () =>
      library.session() && {
        session: library.session(),
        source: library.source(),
        offset: offset(),
        sort: sort(),
        query: props.query,
        revision: revision(),
        completed: library.tasks
          .jobs()
          .filter((job) => job.status === "completed")
          .map((job) => job.task_id)
          .join(","),
        epoch: library.trackSources().find((row) => row.source === library.source())?.scannedAt,
      },
    async (key) => {
      const status = await requestAede<{ capabilities?: string[] }>(
        "/api/v1/status",
        {},
        "GET",
        null,
        key.source,
      );
      if (!status.capabilities?.includes("analysis_coverage"))
        throw Error(
          t("Mettez à jour puis redémarrez Aède pour afficher la couverture des analyses."),
        );
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
  const page = () =>
    report()?.session === library.session() && report()?.source === library.source()
      ? report()?.data
      : undefined;
  return (
    <section class="page analysis-page">
      <div class="page-heading">
        <span>{t("Résultats enregistrés · état du dernier catalogue")}</span>
        <button
          disabled={!library.session() || report.loading}
          onClick={() => setRevision((value) => value + 1)}
        >
          {t("Actualiser")}
        </button>
      </div>
      <Show when={notice().message}>
        <Feedback
          message={notice().message}
          error={notice().failure}
          onClose={() => setNotice({ message: "", failure: false })}
        />
      </Show>
      <Show when={!library.session()}>
        <p class="notice">{t("Connectez-vous pour accéder aux données de votre compte.")}</p>
      </Show>
      <Show when={report.loading}>
        <p role="status">{t("Chargement…")}</p>
      </Show>
      <Show when={report.error}>
        <p class="notice missing-notice" role="alert">
          <span>{String(report.error)}</span>
          <button onClick={() => void refetch()}>{t("Réessayer")}</button>
        </p>
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
                                  name={sort().direction === "asc" ? "chevron-up" : "chevron-down"}
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
                            <td classList={{ "coverage-warning": row.stale > 0 }}>{row.stale}</td>
                            <td classList={{ "coverage-warning": row.failed > 0 }}>{row.failed}</td>
                            <td>
                              {row.spectra}/{row.tracks}
                            </td>
                            <td>
                              <div class="coverage-actions">
                                <button
                                  class="icon-button quiet"
                                  aria-label={t("Gérer les analyses de {0}", row.title)}
                                  aria-expanded={selected() === row.reference}
                                  title={t("Gérer les analyses de {0}", row.title)}
                                  onClick={() =>
                                    setSelected(selected() === row.reference ? "" : row.reference)
                                  }
                                >
                                  <Show
                                    when={activeReleaseJob(library.tasks.jobs(), row.reference)}
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
                                    onStatus={(message, failure) => setNotice({ message, failure })}
                                  />
                                </Show>
                                <CoverPlay reference={row.reference} title={row.title} />
                              </div>
                            </td>
                          </tr>
                          <Show when={selected() === row.reference}>
                            <tr class="analysis-expanded">
                              <td colSpan={7}>
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
              <div class="page-controls">
                <button
                  disabled={!offset()}
                  onClick={() => setOffset((value) => Math.max(0, value - 50))}
                >
                  {t("Précédent")}
                </button>
                <span>
                  {offset() + 1}–{offset() + value().items.length} / {value().total}
                </span>
                <button
                  disabled={offset() + 50 >= value().total}
                  onClick={() => setOffset((value) => value + 50)}
                >
                  {t("Suivant")}
                </button>
              </div>
            </Show>
          </>
        )}
      </Show>
    </section>
  );
}

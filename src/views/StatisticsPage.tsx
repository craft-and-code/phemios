import { RefreshButton } from "../components/RefreshButton";
import { StickyHeader } from "../components/StickyHeader";
import { DownloadButton } from "../components/DownloadButton";
import { StatisticsContent } from "../components/StatisticsContent";
import { Feedback } from "../components/Feedback";
import { exportStatistics, isNative } from "../platform/desktop";
import { csvDocument, statisticsCsv, type CsvRow } from "../library/statistics-csv";
import { locale } from "../i18n";
import { t } from "../i18n";
import { referenceSource } from "../library/sources";
import { createEffect, on, createMemo, createSignal, For, Show } from "solid-js";
import { useLibrary } from "../library/context";
import { createDiagnosticRead } from "../library/diagnostic-read";
import { statisticsSelection } from "../library/statistics-navigation";
import { browseArtists } from "../library/selection";
import { requestAede } from "../platform/desktop";
import {
  statisticsReader,
  parseDiagnosis,
  numberLabel,
  bytesLabel,
  durationLabel,
  type Bucket,
  type Page,
} from "../library/statistics";
import { StatisticsTable, type StatRow } from "../components/StatisticsTable";
import { StatValue } from "../components/StatValue";
/** Server totals stay distinct from public snapshot coverage and current-owner annotations. */
export function StatisticsPage(props: {
  onBrowse: (selection: NonNullable<ReturnType<typeof statisticsSelection>>) => void;
}) {
  const library = useLibrary(),
    [refresh, setRefresh] = createSignal(0),
    [exporting, setExporting] = createSignal(false),
    [exportStatus, setExportStatus] = createSignal(""),
    [exportError, setExportError] = createSignal("");
  const reader = createMemo(() => {
    refresh();
    const owner = library.source();
    return library.session()
      ? statisticsReader((offset) =>
          requestAede("/api/v1/stats", { offset: String(offset), limit: "50" }, "GET", null, owner),
        )
      : undefined;
  });
  const report = createDiagnosticRead(
    () => {
      const read = reader();
      return read ? { read, session: library.session(), source: library.source() } : false;
    },
    (key) => key.read(0),
  );
  const doctor = createDiagnosticRead(
    () =>
      library.session()
        ? { session: library.session(), source: library.source(), refresh: refresh() }
        : false,
    async (key) =>
      parseDiagnosis(await requestAede("/api/v1/doctor", { limit: "1" }, "GET", null, key.source)),
  );
  const loading = () => report.loading() || doctor.loading();
  const principals = createMemo(() => browseArtists(library.artists(), library.albums()));
  const currentReport = report.current;
  const own = () =>
    Object.values(library.annotations).filter(
      (value) => !!value && referenceSource(value.reference) === library.source(),
    );
  const ratings = () => own().filter((value) => value?.rating != null);
  const bucket = (
    page: Page<Bucket>,
    weight = true,
    kind?: "country" | "decade",
  ): Page<StatRow> => ({
    ...page,
    items: page.items.map((row) => {
      const selection = kind ? statisticsSelection(kind, row.label, library.artists()) : undefined;
      return {
        label: row.label,
        count: row.count,
        ...(weight ? { extra: bytesLabel(row.bytes) } : {}),
        ...(selection
          ? { browse: { href: `#/${selection.section}`, select: () => props.onBrowse(selection) } }
          : {}),
      };
    }),
  });
  const tiles = () => {
    const value = currentReport();
    return value
      ? [
          [t("Albums"), numberLabel(value.albums)],
          [t("Compilations"), numberLabel(value.compilations)],
          [t("Pistes"), numberLabel(value.tracks)],
          [t("Fichiers"), numberLabel(value.files)],
          [t("Artistes d’album"), numberLabel(value.album_artists)],
          [t("Artistes et participants"), numberLabel(value.artists)],
          [t("Durée totale"), durationLabel(value.duration_ms)],
          [t("Espace occupé"), bytesLabel(value.bytes)],
          [t("Genres"), numberLabel(value.genres)],
          [t("Labels"), numberLabel(value.labels)],
          [t("Pistes sans album"), numberLabel(value.tracks_without_album)],
        ]
      : [
          [t("Albums du cache"), numberLabel(library.albums().length)],
          [t("Artistes d’album du cache"), numberLabel(principals().length)],
          [t("Participants du cache"), numberLabel(library.artists().length)],
        ];
  };
  const exportScope = createMemo(() => ({ session: library.session(), source: library.source() }));
  createEffect(
    on(exportScope, () => {
      setExportStatus("");
      setExportError("");
    }),
  );
  let pageElement!: HTMLElement;
  async function downloadCsv() {
    if (exporting()) return;
    const session = library.session(),
      source = library.source(),
      read = reader();
    const current = () => session === library.session() && source === library.source();
    const extra: CsvRow[] = [];
    for (const section of pageElement.querySelectorAll<HTMLElement>(".stat-tiles")) {
      const heading =
        section.parentElement?.querySelector("h2")?.textContent ?? t("Votre collection");
      for (const tile of section.children)
        extra.push([
          heading,
          tile.querySelector("span")?.textContent ?? "",
          tile.querySelector(".stat-value")?.textContent ??
            tile.lastElementChild?.textContent ??
            "",
          "",
        ]);
    }
    const average = ratings().length
      ? ratings().reduce((sum, value) => sum + (value?.rating ?? 0), 0) / ratings().length
      : undefined;
    if (average !== undefined) extra.push([t("Votre musique"), t("Note moyenne :"), average, "/5"]);
    if (currentReport())
      for (const [measure, value] of Object.entries(currentReport()!.completeness))
        extra.push([t("Complétude des albums"), measure, value, "ratio"]);
    setExporting(true);
    setExportStatus("");
    setExportError("");
    try {
      const document = read ? await statisticsCsv(read, extra, current) : csvDocument(extra);
      if (!current()) throw new Error(t("Session invalide."));
      const path = await exportStatistics(document);
      if (path && current()) {
        setExportStatus(t("CSV enregistré : {0}", path));
        return true;
      }
      return false;
    } catch (failure) {
      if (current()) setExportError(String(failure));
      return false;
    } finally {
      setExporting(false);
    }
  }
  return (
    <section
      ref={(element) => {
        pageElement = element;
      }}
      class="page statistics-page"
    >
      <StickyHeader>
        <div class="statistics-heading">
          <p>
            {t(
              "Ensemble de la bibliothèque · les filtres du catalogue ne modifient pas ces chiffres.",
            )}
          </p>
          <div class="settings-actions">
            <DownloadButton
              label={t("Télécharger toutes les statistiques en CSV")}
              identity={exportScope()}
              disabled={report.loading() || doctor.loading() || !isNative()}
              busy={exporting()}
              onClick={downloadCsv}
            />
            <RefreshButton
              identity={library.session()}
              busy={loading()}
              disabled={
                !library.session() ||
                ((report.pending() || doctor.pending()) && !report.loading() && !doctor.loading())
              }
              onCancel={() => {
                report.cancel();
                doctor.cancel();
              }}
              onRefresh={() => setRefresh((value) => value + 1)}
            />
          </div>
        </div>
      </StickyHeader>
      <Show when={exportStatus()}>
        <Feedback message={exportStatus()} onClose={() => setExportStatus("")} />
      </Show>
      <Show when={exportError()}>
        <Feedback error message={exportError()} onClose={() => setExportError("")} />
      </Show>
      <Show when={!library.session()}>
        <p class="notice account-notice">
          {t(
            "Vue du cache public. Connectez Aède pour consulter les mesures détaillées, la durée et l’espace disque.",
          )}{" "}
        </p>
      </Show>
      <StatisticsContent busy={loading()}>
        <Show when={report.error()}>
          <Feedback error persistent message={String(report.error())} />
        </Show>
        <h2>{t("Votre collection")}</h2>
        <div class="stat-tiles">
          <For each={tiles()}>
            {(tile) => (
              <div>
                <span>{tile[0]}</span>
                <StatValue value={tile[1]} />
              </div>
            )}
          </For>
        </div>
        <Show when={library.session()}>
          <section>
            <h2>{t("Intégrité et analyses enregistrées")}</h2>
            <Show when={doctor.error()}>
              <Feedback error persistent message={String(doctor.error())} />
            </Show>
            <Show when={doctor.current()}>
              {(result) => (
                <div class="stat-tiles">
                  <For
                    each={
                      [
                        [t("Erreurs"), result().summary.error ?? 0],
                        [t("Avertissements"), result().summary.warning ?? 0],
                        [t("Informations"), result().summary.info ?? 0],
                        [t("Fichiers non vérifiés"), result().unverified_files],
                        [t("Analyses en attente"), result().pending_analyses],
                      ] as const
                    }
                  >
                    {(item) => (
                      <div>
                        <span>{item[0]}</span>
                        <StatValue value={numberLabel(item[1])} />
                      </div>
                    )}
                  </For>
                </div>
              )}
            </Show>
            <small>
              {t(
                "Lecture des résultats existants ; aucun contrôle audio ni analyse n’est lancé.",
              )}{" "}
            </small>
          </section>
          <section>
            <h2>{t("Votre musique")}</h2>
            <div class="stat-tiles">
              <For
                each={
                  [
                    [t("Favoris"), own().filter((value) => value?.loved).length],
                    [t("Notes personnelles"), own().filter((value) => value?.note).length],
                    [t("Entités notées"), ratings().length],
                    [
                      t("Tags personnels distincts"),
                      new Set(own().flatMap((value) => value?.tags ?? [])).size,
                    ],
                  ] as const
                }
              >
                {(item) => (
                  <div>
                    <span>{item[0]}</span>
                    <StatValue value={numberLabel(item[1])} />
                  </div>
                )}
              </For>
            </div>
            <Show when={ratings().length}>
              <p>
                {t("Note moyenne :")}{" "}
                {(
                  ratings().reduce((sum, value) => sum + (value?.rating ?? 0), 0) / ratings().length
                ).toLocaleString(locale(), { maximumFractionDigits: 2 })}{" "}
                / 5
              </p>
            </Show>
            <p class="muted">{t("Annotations de votre compte chargées en mémoire.")}</p>
          </section>
        </Show>
        <section>
          <h2>{t("Couverture du catalogue local")}</h2>
          <div class="stat-tiles">
            <For
              each={
                [
                  [
                    t("Albums sans année"),
                    library.albums().filter((album) => album.year === null).length,
                  ],
                  [
                    t("Artistes d’album sans origine"),
                    principals().filter((artist) => artist.country === null).length,
                  ],
                  [
                    t("Biographies récupérées"),
                    principals().filter((artist) => !!artist.biography).length,
                  ],
                  [
                    t("Bannières disponibles"),
                    principals().filter((artist) => artist.media?.banner).length,
                  ],
                  [
                    t("Arrière-plans disponibles"),
                    principals().filter((artist) => artist.media?.background).length,
                  ],
                  [
                    t("Portraits disponibles"),
                    principals().filter((artist) => artist.media?.portrait).length,
                  ],
                  [t("Images chargées"), library.mediaProgress()[0] - library.mediaErrors()],
                  [t("Images indisponibles"), library.mediaErrors()],
                ] as const
              }
            >
              {(item) => (
                <div>
                  <span>{item[0]}</span>
                  <StatValue value={numberLabel(item[1])} />
                </div>
              )}
            </For>
          </div>
        </section>
        <Show when={currentReport()} keyed>
          {(value) => (
            <>
              <p class="muted">
                {t("Catalogue scanné le")}{" "}
                {new Date(value.scanned_at * 1000).toLocaleString(locale())}
                {t(". Les artistes crédités comprennent aussi les interprètes et auteurs.")}{" "}
              </p>
              <section class="stat-completeness">
                <h2>{t("Complétude des albums")}</h2>
                <div class="stat-tiles">
                  <For
                    each={
                      [
                        [t("Pochettes"), value.completeness.covers],
                        [t("Années"), value.completeness.years],
                        [t("Genres"), value.completeness.genres],
                        [t("Identifiants MusicBrainz"), value.completeness.mbid],
                      ] as const
                    }
                  >
                    {(item) => (
                      <div>
                        <span>{item[0]}</span>
                        <strong>
                          {(item[1] * 100).toLocaleString(locale(), { maximumFractionDigits: 1 })} %
                        </strong>
                        <progress max="1" value={item[1]} />
                      </div>
                    )}
                  </For>
                </div>
                <small>
                  {t(
                    "Présence de métadonnées dans Aède ; une pochette référencée peut rester illisible sur disque.",
                  )}{" "}
                </small>
              </section>
              <div class="stat-tables">
                <StatisticsTable
                  title={t("Formats")}
                  unit={t("Fichiers et taille")}
                  first={value}
                  read={reader()!}
                  rows={(report) => bucket(report.by_codec)}
                />
                <StatisticsTable
                  title={t("Qualité des fichiers")}
                  unit={t("Caractéristiques encodées ; ne certifie pas la qualité de la source")}
                  first={value}
                  read={reader()!}
                  rows={(report) => bucket(report.by_quality)}
                />
                <StatisticsTable
                  title={t("Fréquences d’échantillonnage")}
                  unit={t("Fichiers et taille")}
                  first={value}
                  read={reader()!}
                  rows={(report) => bucket(report.by_sample_rate)}
                />
                <StatisticsTable
                  title={t("Décennies")}
                  unit={t("Albums et taille")}
                  first={value}
                  read={reader()!}
                  rows={(report) => bucket(report.by_decade, true, "decade")}
                />
                <StatisticsTable
                  title={t("Pays et régions")}
                  unit={t("Artistes dont l’origine est connue dans Aède")}
                  first={value}
                  read={reader()!}
                  rows={(report) => bucket(report.by_country, false, "country")}
                />
                <StatisticsTable
                  title={t("Rôles dans les crédits")}
                  unit={t("Crédits ; nombre d’artistes par rôle")}
                  first={value}
                  read={reader()!}
                  rows={(report) => ({
                    ...report.roles,
                    items: report.roles.items.map((row) => ({
                      label: row.role,
                      count: row.credits,
                      extra: t("{0} artistes", numberLabel(row.artists)),
                    })),
                  })}
                />
                <StatisticsTable
                  title={t("Artistes les plus présents")}
                  unit={t("Pistes créditées")}
                  first={value}
                  read={reader()!}
                  rows={(report) => ({
                    ...report.top.artists,
                    items: report.top.artists.items.map((row) => ({
                      label: row.name,
                      count: row.tracks,
                      reference: row.reference,
                    })),
                  })}
                />
                <StatisticsTable
                  title={t("Auteurs les plus présents")}
                  unit={t("Pistes créditées")}
                  first={value}
                  read={reader()!}
                  rows={(report) => ({
                    ...report.top.writers,
                    items: report.top.writers.items.map((row) => ({
                      label: row.name,
                      count: row.tracks,
                      reference: row.reference,
                    })),
                  })}
                />
              </div>
            </>
          )}
        </Show>
      </StatisticsContent>
    </section>
  );
}

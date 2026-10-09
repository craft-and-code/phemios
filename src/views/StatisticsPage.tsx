import { locale } from "../i18n";
import { t } from "../i18n";
import { referenceSource } from "../library/sources";
import { createMemo, createResource, createSignal, For, Show } from "solid-js";
import { useLibrary } from "../library/context";
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
/** Server totals stay distinct from public snapshot coverage and current-owner annotations. */
export function StatisticsPage() {
  const library = useLibrary(),
    [refresh, setRefresh] = createSignal(0);
  const reader = createMemo(() => {
    refresh();
    const owner = library.source();
    return library.session()
      ? statisticsReader((offset) =>
          requestAede("/api/v1/stats", { offset: String(offset), limit: "50" }, "GET", null, owner),
        )
      : undefined;
  });
  const [report] = createResource(reader, (read) => read(0));
  const [doctor] = createResource(
    () =>
      library.session() && {
        session: library.session(),
        source: library.source(),
        refresh: refresh(),
      },
    async (key) =>
      parseDiagnosis(await requestAede("/api/v1/doctor", { limit: "1" }, "GET", null, key.source)),
  );
  const principals = createMemo(() => browseArtists(library.artists(), library.albums()));
  const currentReport = () => (library.session() ? report() : undefined);
  const own = () =>
    Object.values(library.annotations).filter(
      (value) => !!value && referenceSource(value.reference) === library.source(),
    );
  const ratings = () => own().filter((value) => value?.rating != null);
  const bucket = (page: Page<Bucket>, weight = true): Page<StatRow> => ({
    ...page,
    items: page.items.map((row) => ({
      label: row.label,
      count: row.count,
      ...(weight ? { extra: bytesLabel(row.bytes) } : {}),
    })),
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
  return (
    <section class="page statistics-page">
      <div class="statistics-heading">
        <p>
          {t(
            "Ensemble de la bibliothèque · les filtres du catalogue ne modifient pas ces chiffres.",
          )}
        </p>
        <button
          disabled={!library.session() || report.loading}
          onClick={() => setRefresh((value) => value + 1)}
        >
          {t("Actualiser")}{" "}
        </button>
      </div>
      <Show when={!library.session()}>
        <p class="notice">
          {t(
            "Vue du cache public. Connectez Aède pour consulter les mesures détaillées, la durée et l’espace disque.",
          )}{" "}
        </p>
      </Show>
      <Show when={report.loading}>
        <p role="status">{t("Chargement des statistiques Aède…")}</p>
      </Show>
      <Show when={report.error}>
        <p role="alert">
          {t("Statistiques indisponibles :")} {String(report.error)}
        </p>
      </Show>
      <div class="stat-tiles">
        <For each={tiles()}>
          {(tile) => (
            <div>
              <span>{tile[0]}</span>
              <strong>{tile[1]}</strong>
            </div>
          )}
        </For>
      </div>
      <Show when={library.session()}>
        <section>
          <h2>{t("Intégrité et analyses enregistrées")}</h2>
          <Show when={doctor.error}>
            <p role="alert">
              {t("Diagnostic indisponible :")} {String(doctor.error)}
            </p>
          </Show>
          <Show when={doctor.loading}>
            <p>{t("Chargement du diagnostic…")}</p>
          </Show>
          <Show when={doctor()}>
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
                      <strong>{numberLabel(item[1])}</strong>
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
                  <strong>{numberLabel(item[1])}</strong>
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
                rows={(report) => bucket(report.by_decade)}
              />
              <StatisticsTable
                title={t("Pays et régions")}
                unit={t("Artistes dont l’origine est connue dans Aède")}
                first={value}
                read={reader()!}
                rows={(report) => bucket(report.by_country, false)}
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
                <strong>{numberLabel(item[1])}</strong>
              </div>
            )}
          </For>
        </div>
      </section>
    </section>
  );
}

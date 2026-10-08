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
    return library.session()
      ? statisticsReader((offset) =>
          requestAede("/api/v1/stats", { offset: String(offset), limit: "50" }),
        )
      : undefined;
  });
  const [report] = createResource(reader, (read) => read(0));
  const [doctor] = createResource(
    () => library.session() && refresh() + 1,
    async () => parseDiagnosis(await requestAede("/api/v1/doctor", { limit: "1" })),
  );
  const principals = createMemo(() => browseArtists(library.artists(), library.albums()));
  const currentReport = () => (library.session() ? report() : undefined);
  const own = () => Object.values(library.annotations).filter((value) => !!value);
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
          ["Albums", numberLabel(value.albums)],
          ["Compilations", numberLabel(value.compilations)],
          ["Pistes", numberLabel(value.tracks)],
          ["Fichiers", numberLabel(value.files)],
          ["Artistes d’album", numberLabel(value.album_artists)],
          ["Artistes et participants", numberLabel(value.artists)],
          ["Durée totale", durationLabel(value.duration_ms)],
          ["Espace occupé", bytesLabel(value.bytes)],
          ["Genres", numberLabel(value.genres)],
          ["Labels", numberLabel(value.labels)],
          ["Pistes sans album", numberLabel(value.tracks_without_album)],
        ]
      : [
          ["Albums du cache", numberLabel(library.albums().length)],
          ["Artistes d’album du cache", numberLabel(principals().length)],
          ["Participants du cache", numberLabel(library.artists().length)],
        ];
  };
  return (
    <section class="page statistics-page">
      <div class="statistics-heading">
        <p>Ensemble de la bibliothèque · les filtres du catalogue ne modifient pas ces chiffres.</p>
        <button
          disabled={!library.session() || report.loading}
          onClick={() => setRefresh((value) => value + 1)}
        >
          Actualiser
        </button>
      </div>
      <Show when={!library.session()}>
        <p class="notice">
          Vue du cache public. Connectez Aède pour consulter les mesures détaillées, la durée et
          l’espace disque.
        </p>
      </Show>
      <Show when={report.loading}>
        <p role="status">Chargement des statistiques Aède…</p>
      </Show>
      <Show when={report.error}>
        <p role="alert">Statistiques indisponibles : {String(report.error)}</p>
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
          <h2>Intégrité et analyses enregistrées</h2>
          <Show when={doctor.error}>
            <p role="alert">Diagnostic indisponible : {String(doctor.error)}</p>
          </Show>
          <Show when={doctor.loading}>
            <p>Chargement du diagnostic…</p>
          </Show>
          <Show when={doctor()}>
            {(result) => (
              <div class="stat-tiles">
                <For
                  each={
                    [
                      ["Erreurs", result().summary.error ?? 0],
                      ["Avertissements", result().summary.warning ?? 0],
                      ["Informations", result().summary.info ?? 0],
                      ["Fichiers non vérifiés", result().unverified_files],
                      ["Analyses en attente", result().pending_analyses],
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
            Lecture des résultats existants ; aucun contrôle audio ni analyse n’est lancé.
          </small>
        </section>
        <section>
          <h2>Votre musique</h2>
          <div class="stat-tiles">
            <For
              each={
                [
                  ["Favoris", own().filter((value) => value?.loved).length],
                  ["Notes personnelles", own().filter((value) => value?.note).length],
                  ["Entités notées", ratings().length],
                  [
                    "Tags personnels distincts",
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
              Note moyenne :{" "}
              {(
                ratings().reduce((sum, value) => sum + (value?.rating ?? 0), 0) / ratings().length
              ).toLocaleString("fr", { maximumFractionDigits: 2 })}{" "}
              / 5
            </p>
          </Show>
          <p class="muted">Annotations de votre compte chargées en mémoire.</p>
        </section>
      </Show>
      <Show when={currentReport()} keyed>
        {(value) => (
          <>
            <p class="muted">
              Catalogue scanné le {new Date(value.scanned_at * 1000).toLocaleString("fr")}. Les
              artistes crédités comprennent aussi les interprètes et auteurs.
            </p>
            <section class="stat-completeness">
              <h2>Complétude des albums</h2>
              <div class="stat-tiles">
                <For
                  each={
                    [
                      ["Pochettes", value.completeness.covers],
                      ["Années", value.completeness.years],
                      ["Genres", value.completeness.genres],
                      ["Identifiants MusicBrainz", value.completeness.mbid],
                    ] as const
                  }
                >
                  {(item) => (
                    <div>
                      <span>{item[0]}</span>
                      <strong>
                        {(item[1] * 100).toLocaleString("fr", { maximumFractionDigits: 1 })} %
                      </strong>
                      <progress max="1" value={item[1]} />
                    </div>
                  )}
                </For>
              </div>
              <small>
                Présence de métadonnées dans Aède ; une pochette référencée peut rester illisible
                sur disque.
              </small>
            </section>
            <div class="stat-tables">
              <StatisticsTable
                title="Formats"
                unit="Fichiers et taille"
                first={value}
                read={reader()!}
                rows={(report) => bucket(report.by_codec)}
              />
              <StatisticsTable
                title="Qualité des fichiers"
                unit="Caractéristiques encodées ; ne certifie pas la qualité de la source"
                first={value}
                read={reader()!}
                rows={(report) => bucket(report.by_quality)}
              />
              <StatisticsTable
                title="Fréquences d’échantillonnage"
                unit="Fichiers et taille"
                first={value}
                read={reader()!}
                rows={(report) => bucket(report.by_sample_rate)}
              />
              <StatisticsTable
                title="Décennies"
                unit="Albums et taille"
                first={value}
                read={reader()!}
                rows={(report) => bucket(report.by_decade)}
              />
              <StatisticsTable
                title="Pays et régions"
                unit="Artistes dont l’origine est connue dans Aède"
                first={value}
                read={reader()!}
                rows={(report) => bucket(report.by_country, false)}
              />
              <StatisticsTable
                title="Rôles dans les crédits"
                unit="Crédits ; nombre d’artistes par rôle"
                first={value}
                read={reader()!}
                rows={(report) => ({
                  ...report.roles,
                  items: report.roles.items.map((row) => ({
                    label: row.role,
                    count: row.credits,
                    extra: `${numberLabel(row.artists)} artistes`,
                  })),
                })}
              />
              <StatisticsTable
                title="Artistes les plus présents"
                unit="Pistes créditées"
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
                title="Auteurs les plus présents"
                unit="Pistes créditées"
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
        <h2>Couverture du catalogue local</h2>
        <div class="stat-tiles">
          <For
            each={
              [
                [
                  "Albums sans année",
                  library.albums().filter((album) => album.year === null).length,
                ],
                [
                  "Artistes d’album sans origine",
                  principals().filter((artist) => artist.country === null).length,
                ],
                [
                  "Biographies récupérées",
                  principals().filter((artist) => !!artist.biography).length,
                ],
                [
                  "Bannières disponibles",
                  principals().filter((artist) => artist.media?.banner).length,
                ],
                [
                  "Arrière-plans disponibles",
                  principals().filter((artist) => artist.media?.background).length,
                ],
                [
                  "Portraits disponibles",
                  principals().filter((artist) => artist.media?.portrait).length,
                ],
                ["Images chargées", library.mediaProgress()[0] - library.mediaErrors()],
                ["Images indisponibles", library.mediaErrors()],
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

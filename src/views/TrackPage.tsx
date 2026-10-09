import { locale } from "../i18n";
import { t } from "../i18n";
import { createResource, For, Show } from "solid-js";
import { useLibrary } from "../library/context";
import { requestAede } from "../platform/desktop";
import { parseTrackDetail } from "../library/track-detail";
import { Artwork } from "../components/Artwork";
import { AnnotationPanel } from "../components/AnnotationPanel";
import { fileSize, trackDuration } from "../library/detail-format";
import { TrackResults } from "../components/TrackResults";
/** Track facts, credits, annotations and retained results share the catalog detail conventions. */
export function TrackPage(props: { reference: string }) {
  const library = useLibrary();
  const [detail] = createResource(
    () => (library.sessionFor(props.reference) ? props.reference : false),
    async (ref) => parseTrackDetail(await requestAede("/api/v1/track", { ref }), ref),
  );
  const album = () => library.albums().find((a) => a.reference === detail()?.release);
  const format = (v: number | null, unit: string) =>
    v === null ? t("Non renseigné") : `${v.toLocaleString(locale())} ${unit}`;
  return (
    <article class="page track-page">
      <Show when={!library.sessionFor(props.reference)}>
        <p class="notice">{t("Connectez Aède pour consulter ce titre.")}</p>
      </Show>
      <Show when={detail.loading}>
        <p role="status">{t("Chargement du titre…")}</p>
      </Show>
      <Show when={detail.error}>
        <p role="alert">
          {t("Titre indisponible :")} {String(detail.error)}
        </p>
      </Show>
      <Show when={!detail.loading && !detail.error && detail()}>
        {(row) => (
          <>
            <div class="album-hero">
              <Show when={album()}>
                {(a) => (
                  <a href={`#/album/${encodeURIComponent(a().reference)}`}>
                    <Artwork album={a()} />
                  </a>
                )}
              </Show>
              <div>
                <p class="eyebrow">{t("PISTE")}</p>
                <h1>{row().title}</h1>
                <Show when={album()} fallback={<p>{t("Sans album")}</p>}>
                  {(a) => (
                    <p>
                      <a href={`#/album/${encodeURIComponent(a().reference)}`}>{a().title}</a>{" "}
                      {t("· CD")} {row().disc_no ?? "?"} {t("· Piste")} {row().track_no ?? "?"}
                    </p>
                  )}
                </Show>
              </div>
            </div>
            <section>
              <h2>{t("Fichier et format")}</h2>
              <dl class="track-facts">
                <div>
                  <dt>{t("Codec / conteneur")}</dt>
                  <dd>
                    {row().properties.codec} / {row().properties.container}
                  </dd>
                </div>
                <div>
                  <dt>{t("Durée")}</dt>
                  <dd>{trackDuration(row().duration_ms)}</dd>
                </div>
                <div>
                  <dt>{t("Fréquence")}</dt>
                  <dd>{format(row().properties.sample_rate, "Hz")}</dd>
                </div>
                <div>
                  <dt>{t("Profondeur de bits")}</dt>
                  <dd>{format(row().properties.bit_depth, "bits")}</dd>
                </div>
                <div>
                  <dt>{t("Canaux")}</dt>
                  <dd>{format(row().properties.channels, "")}</dd>
                </div>
                <div>
                  <dt>{t("Débit")}</dt>
                  <dd>{format(row().properties.bitrate_kbps, "kbit/s")}</dd>
                </div>
                <div>
                  <dt>{t("Taille")}</dt>
                  <dd>{fileSize(row().size)}</dd>
                </div>
              </dl>
              <Show when={row().path}>
                <p class="track-path">{row().path}</p>
              </Show>
            </section>
            <Show when={row().credits.length}>
              <section>
                <h2>{t("Crédits")}</h2>
                <ul class="personal-list">
                  <For each={row().credits}>
                    {(c) => (
                      <li>
                        <a href={`#/artist/${encodeURIComponent(c.reference)}`}>{c.name}</a>
                        <span>{c.role}</span>
                        <small>
                          {t("Source :")} {c.source}
                        </small>
                      </li>
                    )}
                  </For>
                </ul>
              </section>
            </Show>
            <section>
              <h2>{t("Tags du fichier")}</h2>
              <dl class="file-tags">
                <For each={Object.entries(row().tags)}>
                  {([key, values]) => (
                    <div>
                      <dt>{key}</dt>
                      <dd>{values.join(" · ")}</dd>
                    </div>
                  )}
                </For>
              </dl>
            </section>
            <AnnotationPanel reference={props.reference} kind="track" />
            <section>
              <h2>{t("Lecture et résultats enregistrés")}</h2>
              <ol class="track-list">
                <TrackResults
                  track={row()}
                  expanded
                  number={row().track_no ?? 1}
                  onPlay={() => void library.player.startReference(props.reference)}
                />
              </ol>
            </section>
          </>
        )}
      </Show>
    </article>
  );
}

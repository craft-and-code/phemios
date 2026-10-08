import { createResource, For, Show } from "solid-js";
import { useLibrary } from "../library/context";
import { requestAede } from "../platform/desktop";
import { parseTrackDetail } from "../library/track-detail";
import { Artwork } from "../components/Artwork";
import { AnnotationPanel } from "../components/AnnotationPanel";
import { TrackResults } from "../components/TrackResults";
/** Track facts, credits, annotations and retained results share the catalog detail conventions. */
export function TrackPage(props: { reference: string }) {
  const library = useLibrary();
  const [detail] = createResource(
    () => (library.session() ? props.reference : false),
    async (ref) => parseTrackDetail(await requestAede("/api/v1/track", { ref }), ref),
  );
  const album = () => library.albums().find((a) => a.reference === detail()?.release);
  const format = (v: number | null, unit: string) =>
    v === null ? "Non renseigné" : `${v.toLocaleString("fr")} ${unit}`;
  return (
    <article class="page track-page">
      <Show when={!library.session()}>
        <p class="notice">Connectez Aède pour consulter ce titre.</p>
      </Show>
      <Show when={detail.loading}>
        <p role="status">Chargement du titre…</p>
      </Show>
      <Show when={detail.error}>
        <p role="alert">Titre indisponible : {String(detail.error)}</p>
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
                <p class="eyebrow">PISTE</p>
                <h1>{row().title}</h1>
                <Show when={album()} fallback={<p>Sans album</p>}>
                  {(a) => (
                    <p>
                      <a href={`#/album/${encodeURIComponent(a().reference)}`}>{a().title}</a> · CD{" "}
                      {row().disc_no ?? "?"} · Piste {row().track_no ?? "?"}
                    </p>
                  )}
                </Show>
              </div>
            </div>
            <section>
              <h2>Fichier et format</h2>
              <dl class="track-facts">
                <div>
                  <dt>Codec / conteneur</dt>
                  <dd>
                    {row().properties.codec} / {row().properties.container}
                  </dd>
                </div>
                <div>
                  <dt>Durée</dt>
                  <dd>
                    {row().duration_ms === null
                      ? "Inconnue"
                      : format(Math.round(row().duration_ms! / 1000), "s")}
                  </dd>
                </div>
                <div>
                  <dt>Fréquence</dt>
                  <dd>{format(row().properties.sample_rate, "Hz")}</dd>
                </div>
                <div>
                  <dt>Résolution</dt>
                  <dd>{format(row().properties.bit_depth, "bits")}</dd>
                </div>
                <div>
                  <dt>Canaux</dt>
                  <dd>{format(row().properties.channels, "")}</dd>
                </div>
                <div>
                  <dt>Débit</dt>
                  <dd>{format(row().properties.bitrate_kbps, "kbit/s")}</dd>
                </div>
                <div>
                  <dt>Taille</dt>
                  <dd>{format(row().size, "octets")}</dd>
                </div>
              </dl>
              <Show when={row().path}>
                <p class="track-path">{row().path}</p>
              </Show>
            </section>
            <Show when={row().credits.length}>
              <section>
                <h2>Crédits</h2>
                <ul class="personal-list">
                  <For each={row().credits}>
                    {(c) => (
                      <li>
                        <a href={`#/artist/${encodeURIComponent(c.reference)}`}>{c.name}</a>
                        <span>{c.role}</span>
                        <small>Source : {c.source}</small>
                      </li>
                    )}
                  </For>
                </ul>
              </section>
            </Show>
            <section>
              <h2>Tags du fichier</h2>
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
              <h2>Lecture et résultats enregistrés</h2>
              <ol class="track-list">
                <TrackResults
                  track={row()}
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

import { For, Show } from "solid-js";
import { t } from "../i18n";
import { cdError, type CdDrive } from "../cd/model";
import { collectionDuration } from "../library/detail-format";
import { ChoiceSelect } from "./ChoiceSelect";
import { EmptyState } from "./EmptyState";
import { PageLoader } from "./PageLoader";
import { Feedback } from "./Feedback";
import { Icon } from "./Icon";
import { CoverPlayView } from "./CoverPlayView";
/** Props-only CD presentation is shared by the native page and component explorer. */
export function CdContent(props: {
  drives: readonly CdDrive[];
  selected: string;
  busy: boolean;
  error: string;
  native: boolean;
  playing: string;
  canPlay: boolean;
  transportBusy: boolean;
  discPlaying?: boolean;
  ejecting: boolean;
  onSelect: (id: string) => void;
  onPlay: (index: number) => void;
  onEject: () => void;
}) {
  const drive = () => props.drives.find((d) => d.id === props.selected),
    disc = () => drive()?.disc;
  const duration = () => disc()?.tracks.reduce((sum, track) => sum + track.duration_ms, 0) ?? 0;
  return (
    <>
      <Show when={props.error}>
        <Feedback error message={props.error} />
      </Show>
      <Show when={!props.busy} fallback={<PageLoader label={t("Détection des lecteurs CD…")} />}>
        <Show
          when={props.drives.length}
          fallback={
            <EmptyState icon="cd">
              {props.native
                ? t("Branchez un lecteur et insérez un CD audio.")
                : t("La lecture CD nécessite l’application desktop.")}
            </EmptyState>
          }
        >
          <div class="cd-workspace">
            <aside class="cd-source">
              <div class="cd-disc-art" aria-hidden="true">
                <span />
              </div>
              <ChoiceSelect
                label={t("Source CD")}
                value={props.selected}
                onChange={props.onSelect}
                options={props.drives.map((d) => ({ value: d.id, label: d.name }))}
                disabled={props.transportBusy || props.ejecting}
              />
              <small>{t("Lecture locale · aucun serveur requis")}</small>
            </aside>
            <div class="cd-details">
              <div class="cd-heading">
                <div>
                  <span class="eyebrow">{t("SOURCE MUSICALE")}</span>
                  <h1>{disc()?.title || (drive()?.image ? t("Image CUE") : t("CD audio"))}</h1>
                  <Show when={disc()?.artist}>{(artist) => <p>{artist()}</p>}</Show>
                  <Show when={disc()}>
                    <p>
                      {t(
                        disc()!.tracks.length === 1 ? "{0} piste" : "{0} pistes",
                        disc()!.tracks.length,
                      )}{" "}
                      · {collectionDuration(duration())}
                    </p>
                    <p class="muted">{t("16 bits · 44,1 kHz · stéréo")}</p>
                  </Show>
                </div>
                <div class="cd-actions">
                  <button
                    class="icon-button"
                    disabled={!disc() || props.discPlaying || props.ejecting || props.transportBusy}
                    title={drive()?.image ? t("Fermer l’image CD") : t("Éjecter le CD")}
                    aria-label={drive()?.image ? t("Fermer l’image CD") : t("Éjecter le CD")}
                    aria-busy={props.ejecting}
                    onClick={props.onEject}
                  >
                    <Show when={!props.ejecting} fallback={<span class="spinner" />}>
                      <Icon name={drive()?.image ? "close" : "eject"} />
                    </Show>
                  </button>
                  <Show when={disc()}>
                    <CoverPlayView
                      reference={disc()!.tracks[0]!.reference}
                      title={t("le CD")}
                      variant="detail"
                      disabled={!props.canPlay || props.transportBusy || props.ejecting}
                      onPlay={async () => props.onPlay(0)}
                    />
                  </Show>
                </div>
              </div>
              <Show
                when={disc()}
                fallback={
                  <EmptyState icon="cd">
                    {cdError(drive()?.error ?? "Aucun CD audio dans ce lecteur.")}
                  </EmptyState>
                }
              >
                <Show when={!props.canPlay}>
                  <Feedback
                    message={t(
                      "La lecture CD est indisponible pour un compte supervisé ou cette sortie audio.",
                    )}
                  />
                </Show>
                <ol class="cd-tracks">
                  <For each={disc()!.tracks}>
                    {(track, index) => (
                      <li classList={{ current: props.playing === track.reference }}>
                        <span class="cd-track-number">{track.number}</span>
                        <span class="cd-track-title">
                          {track.title || t("Piste {0}", track.number)}
                        </span>
                        <time>{collectionDuration(track.duration_ms)}</time>
                        <CoverPlayView
                          variant="row"
                          reference={track.reference}
                          title={t("Piste {0}", track.number)}
                          label={t("Lire la piste {0}", track.number)}
                          disabled={!props.canPlay || props.transportBusy || props.ejecting}
                          onPlay={async () => props.onPlay(index())}
                        />
                      </li>
                    )}
                  </For>
                </ol>
              </Show>
            </div>
          </div>
        </Show>
      </Show>
    </>
  );
}

import { For, Show } from "solid-js";
import { t } from "../i18n";
import { cdError, cdPlaybackAction, type CdDrive } from "../cd/model";
import { collectionDuration } from "../library/detail-format";
import { ChoiceSelect } from "./ChoiceSelect";
import { EmptyState } from "./EmptyState";
import { PageLoader } from "./PageLoader";
import { Feedback } from "./Feedback";
import { CoverPlayView } from "./CoverPlayView";
/** Props-only CD presentation is shared by the native page and component explorer. */
export function CdContent(props: {
  drives: readonly CdDrive[];
  selected: string;
  busy: boolean;
  error: string;
  native: boolean;
  playing: string;
  playbackStatus?: string;
  canPlay: boolean;
  transportBusy: boolean;
  ejecting: boolean;
  onSelect: (id: string) => void;
  onPlay: (index?: number) => void | Promise<void>;
}) {
  const drive = () => props.drives.find((d) => d.id === props.selected),
    disc = () => drive()?.disc;
  const duration = () => disc()?.tracks.reduce((sum, track) => sum + track.duration_ms, 0) ?? 0;
  const action = (track?: string) =>
    cdPlaybackAction(disc()?.token, props.playing, props.playbackStatus ?? "idle", track);
  const disabled = (track?: string) =>
    props.transportBusy || props.ejecting || (!props.canPlay && action(track) !== "pause");
  const label = (track?: number) => {
    const value = action(track === undefined ? undefined : disc()?.tracks[track]?.reference);
    if (track === undefined)
      return value === "pause"
        ? t("Mettre le CD en pause")
        : value === "resume"
          ? t("Reprendre le CD")
          : t("Lire le CD");
    const number = disc()?.tracks[track]?.number ?? track + 1;
    return value === "pause"
      ? t("Mettre la piste {0} en pause", number)
      : value === "resume"
        ? t("Reprendre la piste {0}", number)
        : t("Lire la piste {0}", number);
  };
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
                  <Show when={disc()}>
                    <CoverPlayView
                      reference={disc()!.tracks[0]!.reference}
                      title={t("le CD")}
                      variant="detail"
                      action={action()}
                      label={label()}
                      disabled={disabled()}
                      onPlay={async () => props.onPlay()}
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
                          action={action(track.reference)}
                          label={label(index())}
                          disabled={disabled(track.reference)}
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

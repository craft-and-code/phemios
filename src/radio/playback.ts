import type { ExternalParentalMedia } from "../library/parental-access";
import { browserRadioMedia } from "./browser-media";
export { browserRadioMedia } from "./browser-media";
import { t } from "../i18n";
import { createSignal, onCleanup } from "solid-js";
import { parseResolved, type Station } from "./directory";
export interface RadioMedia {
  /** Prepare a silent optional measurement context while explicit user activation is available. */
  prepare?: () => void;
  /** Pre-output samples from this radio only; false means no readable signal. */
  sample?: (target: Float32Array<ArrayBuffer>) => boolean;
  source: (url: string) => void;
  volume: (value: number) => void;
  play: () => Promise<void>;
  release: () => void;
  callbacks: (playing: () => void, waiting: () => void, failure: () => void) => void;
}
/** Latest explicit selection owns the media; captured authorization binds its owner before preparation.
 * Admission remains immediately before play. Disposal closes media permanently; uninterrupted stalls share one deadline.
 */
export function createRadioPlayback(
  resolve: (uuid: string) => Promise<unknown>,
  beforePlay: () => Promise<void>,
  createMedia = browserRadioMedia,
  initialVolume?: () => number | Promise<number>,
  authorize?:
    | ((media: ExternalParentalMedia) => Promise<void>)
    | { capture: () => (media: ExternalParentalMedia) => Promise<void> },
  rememberVolume?: (value: number) => void,
  unmutedVolume?: () => number,
) {
  const [station, setStation] = createSignal<Station>(),
    [status, setStatus] = createSignal<"idle" | "connecting" | "playing" | "paused" | "error">(
      "idle",
    ),
    [error, setError] = createSignal(""),
    [volume, setVolume] = createSignal(0.5),
    [revision, setRevision] = createSignal(0);
  let alive = true,
    media: RadioMedia | undefined,
    epoch = 0,
    audible = 0.5,
    volumeRevision = 0,
    inheritingVolume = false,
    stall: ReturnType<typeof setTimeout> | undefined;
  function release() {
    epoch++;
    clearTimeout(stall);
    stall = undefined;
    media?.release();
    media = undefined;
  }
  function stop() {
    setRevision((value) => value + 1);
    release();
    setStation(undefined);
    setStatus("idle");
    setError("");
  }
  function pause() {
    if (!station()) return;
    setRevision((value) => value + 1);
    release();
    setStatus("paused");
  }
  async function start(selected: Station) {
    if (!alive) return;
    setRevision((value) => value + 1);
    const inheritVolume = status() === "idle" || volumeRevision === 0 || inheritingVolume,
      volumeTicket = volumeRevision;
    inheritingVolume = inheritVolume && !!initialVolume;
    release();
    const held = epoch;
    setStation(selected);
    setStatus("connecting");
    setError("");
    try {
      const admit = typeof authorize === "function" ? authorize : authorize?.capture();
      const audio = createMedia();
      media = audio;
      audio.prepare?.();
      await beforePlay();
      if (held !== epoch) return;
      if (inheritVolume && initialVolume) {
        const initial = initialVolume();
        const value = typeof initial === "number" ? initial : await initial;
        if (held !== epoch || !alive) return;
        if (volumeTicket === volumeRevision) changeVolume(value, false);
      }
      const url = parseResolved(await resolve(selected.uuid), selected.uuid);
      if (held !== epoch) return;
      const watch = () => {
        if (stall !== undefined) return;
        stall = setTimeout(() => {
          if (held !== epoch) return;
          release();
          setStatus("error");
          setError(
            t("La station ne transmet plus de son. Réessayez ou choisissez une autre station."),
          );
        }, 20000);
      };
      watch();
      audio.callbacks(
        () => {
          if (held === epoch) {
            clearTimeout(stall);
            stall = undefined;
            setStatus("playing");
          }
        },
        () => {
          if (held === epoch) {
            setStatus("connecting");
            watch();
          }
        },
        () => {
          if (held !== epoch) return;
          release();
          setStatus("error");
          setError(
            t(
              "Flux radio interrompu ou format non pris en charge. Réessayez ou choisissez une autre station.",
            ),
          );
        },
      );
      audio.volume(volume());
      audio.source(url);
      if (admit) await admit({ kind: "radio" });
      if (held !== epoch || !alive) return;
      await audio.play();
    } catch (failure) {
      if (held !== epoch) return;
      release();
      setStatus("error");
      setError(
        failure instanceof Error
          ? failure.name === "NotSupportedError"
            ? t(
                "Ce flux est bloqué ou son format n’est pas pris en charge par le lecteur système. Essayez un flux HTTPS.",
              )
            : failure.name === "NotAllowedError"
              ? t(
                  "Le lecteur système a refusé de démarrer ce flux. Relancez l’écoute explicitement.",
                )
              : failure.name === "AbortError"
                ? t(
                    "Le lecteur système a interrompu le démarrage de cette radio. Réessayez ou choisissez une autre station.",
                  )
                : failure.message
          : t("Lecture radio impossible."),
      );
    }
  }
  function changeVolume(value: number, remember = true) {
    if (!Number.isFinite(value) || value < 0 || value > 1) return;
    volumeRevision++;
    inheritingVolume = false;
    setVolume(value);
    media?.volume(value);
    if (value > 0) audible = value;
    if (remember) rememberVolume?.(value);
  }
  onCleanup(() => {
    alive = false;
    stop();
  });
  return {
    station,
    sample(target: Float32Array<ArrayBuffer>) {
      target.fill(0);
      return status() === "playing" && !!media?.sample?.(target);
    },
    status,
    revision,
    error,
    volume,
    start,
    stop,
    pause,
    resume: () => {
      const selected = station();
      if (selected) void start(selected);
    },
    changeVolume,
    mute: () => changeVolume(volume() === 0 ? (unmutedVolume?.() ?? audible) : 0),
  };
}

import { t } from "../i18n";
import { createSignal, onCleanup } from "solid-js";
import { parseResolved, type Station } from "./directory";
export interface RadioMedia {
  source: (url: string) => void;
  volume: (value: number) => void;
  play: () => Promise<void>;
  release: () => void;
  callbacks: (playing: () => void, waiting: () => void, failure: () => void) => void;
}
/** Use native WebView codecs for live Internet media, with no Aède credentials or catalogue history. */
export function browserRadioMedia(): RadioMedia {
  const audio = new Audio();
  audio.preload = "none";
  return {
    source: (url) => {
      audio.src = url;
    },
    volume: (value) => {
      audio.volume = value;
    },
    play: () => audio.play(),
    release: () => {
      audio.onplaying = null;
      audio.onwaiting = null;
      audio.onerror = null;
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
    },
    callbacks: (playing, waiting, failure) => {
      audio.onplaying = playing;
      audio.onwaiting = waiting;
      audio.onerror = failure;
    },
  };
}
/** Latest explicit selection owns the media. Disposal closes it permanently; uninterrupted stalls share one deadline. */
export function createRadioPlayback(
  resolve: (uuid: string) => Promise<unknown>,
  beforePlay: () => Promise<void>,
  createMedia = browserRadioMedia,
  initialVolume?: () => number,
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
    if (status() === "idle" && initialVolume) changeVolume(initialVolume());
    release();
    const held = epoch;
    setStation(selected);
    setStatus("connecting");
    setError("");
    try {
      await beforePlay();
      if (held !== epoch) return;
      const url = parseResolved(await resolve(selected.uuid), selected.uuid);
      if (held !== epoch) return;
      const audio = createMedia();
      media = audio;
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
  function changeVolume(value: number) {
    if (!Number.isFinite(value) || value < 0 || value > 1) return;
    setVolume(value);
    media?.volume(value);
    if (value > 0) audible = value;
  }
  onCleanup(() => {
    alive = false;
    stop();
  });
  return {
    station,
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
    mute: () => changeVolume(volume() === 0 ? audible : 0),
  };
}

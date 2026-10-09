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
/** Latest explicit selection owns the media; late directory replies cannot restart stopped playback. */
export function createRadioPlayback(
  resolve: (uuid: string) => Promise<unknown>,
  beforePlay: () => Promise<void>,
  createMedia = browserRadioMedia,
) {
  const [station, setStation] = createSignal<Station>(),
    [status, setStatus] = createSignal<"idle" | "connecting" | "playing" | "paused" | "error">(
      "idle",
    ),
    [error, setError] = createSignal(""),
    [volume, setVolume] = createSignal(0.5);
  let media: RadioMedia | undefined,
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
    release();
    setStation(undefined);
    setStatus("idle");
    setError("");
  }
  function pause() {
    if (!station()) return;
    release();
    setStatus("paused");
  }
  async function start(selected: Station) {
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
        clearTimeout(stall);
        stall = setTimeout(() => {
          if (held !== epoch) return;
          release();
          setStatus("error");
          setError(
            "La station ne transmet plus de son. Réessayez ou choisissez une autre station.",
          );
        }, 20000);
      };
      watch();
      audio.callbacks(
        () => {
          if (held === epoch) {
            clearTimeout(stall);
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
            "Flux radio interrompu ou format non pris en charge. Réessayez ou choisissez une autre station.",
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
            ? "Ce flux est bloqué ou son format n’est pas pris en charge par le lecteur système. Essayez un flux HTTPS."
            : failure.name === "NotAllowedError"
              ? "Le lecteur système a refusé de démarrer ce flux. Relancez l’écoute explicitement."
              : failure.message
          : "Lecture radio impossible.",
      );
    }
  }
  function changeVolume(value: number) {
    if (!Number.isFinite(value) || value < 0 || value > 1) return;
    setVolume(value);
    media?.volume(value);
    if (value > 0) audible = value;
  }
  onCleanup(stop);
  return {
    station,
    status,
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

import type { ExternalParentalMedia } from "../library/parental-access";
import { createSignal, onCleanup } from "solid-js";
import { episodeListened } from "./listened";
import { t } from "../i18n";
import { podcastUrl, type Episode, type Podcast } from "./feed";
export interface PodcastMedia {
  played?: () => readonly (readonly [number, number])[];
  source: (url: string) => void;
  play: () => Promise<void>;
  pause: () => void;
  release: () => void;
  volume: (n: number) => void;
  seek: (seconds: number) => void;
  callbacks: (
    change: (status: "playing" | "connecting" | "ended" | "error") => void,
    time: (position: number, duration: number) => void,
  ) => void;
}
/** Finite episodes retain their media element on pause so resume does not rejoin a live stream. */
export function browserPodcastMedia(): PodcastMedia {
  const audio = new Audio();
  audio.preload = "metadata";
  return {
    played: () =>
      Array.from(
        { length: audio.played.length },
        (_, i) => [audio.played.start(i), audio.played.end(i)] as const,
      ),
    source: (url) => {
      audio.src = url;
    },
    play: () => audio.play(),
    pause: () => audio.pause(),
    volume: (n) => {
      audio.volume = n;
    },
    seek: (n) => {
      audio.currentTime = n;
    },
    release: () => {
      audio.onplaying = null;
      audio.onwaiting = null;
      audio.onended = null;
      audio.onerror = null;
      audio.ontimeupdate = null;
      audio.onloadedmetadata = null;
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
    },
    callbacks: (change, time) => {
      audio.onplaying = () => change("playing");
      audio.onwaiting = () => change("connecting");
      audio.onended = () => change("ended");
      audio.onerror = () => change("error");
      const update = () => time(audio.currentTime, audio.duration);
      audio.ontimeupdate = update;
      audio.onloadedmetadata = update;
    },
  };
}
/** Explicit episode ownership and play-attempt tickets reject late completions after pause/restart.
 * Pause retains its finite media and clock; a superseded play rejection cannot release it.
 * Podcast playback never records catalogue music history.
 */
export function createPodcastPlayback(
  beforePlay: () => Promise<void>,
  createMedia = browserPodcastMedia,
  completed: (feed: string, id: string) => void = () => {},
  initialVolume?: () => number,
  captureOwner: () => () => boolean = () => () => true,
  authorize?: (media: ExternalParentalMedia) => Promise<void>,
  rememberVolume?: (value: number) => void,
) {
  const [episode, setEpisode] = createSignal<Episode>(),
    [podcast, setPodcast] = createSignal<Podcast>(),
    [status, setStatus] = createSignal<
      "idle" | "connecting" | "playing" | "paused" | "ended" | "error"
    >("idle"),
    [error, setError] = createSignal(""),
    [position, setPosition] = createSignal(0),
    [duration, setDuration] = createSignal(0),
    [volume, setVolume] = createSignal(0.5);
  let media: PodcastMedia | undefined,
    epoch = 0,
    playAttempt = 0,
    audible = 0.5,
    stall: ReturnType<typeof setTimeout> | undefined,
    retainedOwner: (() => boolean) | undefined;
  function release() {
    epoch++;
    playAttempt++;
    clearTimeout(stall);
    media?.release();
    media = undefined;
    retainedOwner = undefined;
  }
  function stop() {
    release();
    setEpisode(undefined);
    setPodcast(undefined);
    setStatus("idle");
    setError("");
    setPosition(0);
    setDuration(0);
  }
  function fail() {
    release();
    setStatus("error");
    setError(t("Épisode interrompu ou format audio non pris en charge."));
  }
  function watch(held: number) {
    clearTimeout(stall);
    stall = setTimeout(() => {
      if (epoch === held) fail();
    }, 20000);
  }
  async function start(feed: Podcast, row: Episode) {
    const ownerCurrent = captureOwner();
    if (!ownerCurrent()) return;
    if (["idle", "ended", "error"].includes(status()) && initialVolume)
      changeVolume(initialVolume(), false);
    release();
    const held = epoch,
      attempt = ++playAttempt;
    setPodcast(feed);
    setEpisode(row);
    setStatus("connecting");
    setError("");
    setPosition(0);
    setDuration(row.duration ?? 0);
    try {
      const url = podcastUrl(row.url);
      await beforePlay();
      if (epoch !== held || !ownerCurrent()) return;
      const audio = createMedia();
      media = audio;
      retainedOwner = ownerCurrent;
      let marked = false;
      function markListened() {
        if (marked || epoch !== held || !ownerCurrent() || !audio.played) return;
        if (episodeListened(audio.played(), duration())) {
          marked = true;
          completed(feed.url, row.id);
        }
      }
      audio.callbacks(
        (next) => {
          if (epoch !== held || status() === "paused") return;
          if (next === "error") {
            fail();
            return;
          }
          setStatus(next);
          if (next === "ended") markListened();
          if (next === "connecting") watch(held);
          else clearTimeout(stall);
        },
        (pos, total) => {
          if (epoch !== held) return;
          if (Number.isFinite(pos) && pos >= 0) setPosition(pos);
          if (Number.isFinite(total) && total > 0) setDuration(total);
          if (status() !== "paused") markListened();
        },
      );
      audio.volume(volume());
      audio.source(url);
      watch(held);
      if (authorize) await authorize({ kind: "podcast", feed: feed.url });
      if (epoch !== held || attempt !== playAttempt || !ownerCurrent()) return;
      await audio.play();
    } catch (e) {
      if (epoch !== held || attempt !== playAttempt) return;
      fail();
      if (authorize && e instanceof Error) setError(e.message);
      if (e instanceof Error && e.name === "NotAllowedError")
        setError(t("Relancez explicitement la lecture de cet épisode."));
    }
  }
  function pause() {
    if (!media) return;
    clearTimeout(stall);
    playAttempt++;
    setStatus("paused");
    media.pause();
  }
  async function resume() {
    if (!media) {
      const feed = podcast(),
        row = episode();
      if (feed && row) await start(feed, row);
      return;
    }
    const held = epoch,
      attempt = ++playAttempt,
      ownerCurrent = retainedOwner,
      selected = podcast();
    if (!ownerCurrent?.() || !selected) {
      stop();
      return;
    }
    setStatus("connecting");
    watch(held);
    try {
      if (authorize) await authorize({ kind: "podcast", feed: selected.url });
      if (epoch !== held || attempt !== playAttempt || !ownerCurrent() || !media) return;
      await media.play();
    } catch (failure) {
      if (held === epoch && attempt === playAttempt) {
        fail();
        if (failure instanceof Error) setError(failure.message);
      }
    }
  }
  function changeVolume(n: number, remember = true) {
    if (!Number.isFinite(n) || n < 0 || n > 1) return;
    setVolume(n);
    media?.volume(n);
    if (n > 0) audible = n;
    if (remember) rememberVolume?.(n);
  }
  function seek(n: number) {
    if (!media || !Number.isFinite(n) || n < 0 || !duration() || n > duration()) return;
    try {
      media.seek(n);
      setPosition(n);
    } catch {
      setError(t("Position de lecture indisponible pour cet épisode."));
    }
  }
  onCleanup(stop);
  return {
    episode,
    podcast,
    status,
    error,
    position,
    duration,
    volume,
    start,
    pause,
    resume,
    stop,
    seek,
    changeVolume,
    mute: () => changeVolume(volume() === 0 ? audible : 0),
  };
}

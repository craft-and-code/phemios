import { interfacePreferences } from "../library/account-preferences";
import { lyricAct } from "../visualizer/lyric-treatment";
import {
  createEffect,
  createMemo,
  createSignal,
  For,
  Show,
  onMount,
  onCleanup,
  on,
} from "solid-js";
import { t } from "../i18n";
import { useLibrary } from "../library/context";
import { createTrackLyrics } from "../library/track-lyrics";
import { announceSetting } from "../library/saved-settings";
import { currentLyricText, activeLyricTime } from "../library/lyrics";
import { playbackLayers, playbackWords } from "../visualizer/layers";
import { FrequencyBars } from "../components/FrequencyBars";
import { PlaybackLyrics } from "../components/PlaybackLyrics";
import { PlaybackQueue } from "../components/PlaybackQueue";
import { AudioScene } from "../components/AudioScene";
import { EmptyState } from "../components/EmptyState";
import { Icon } from "../components/Icon";
import { Artwork } from "../components/Artwork";
import type { Scene } from "../visualizer/particles";
/** Optional playback workspace; the queue and visuals use the same native clock as the footer. */
export function PlaybackPage() {
  const library = useLibrary(),
    player = library.player,
    [queue, setQueue] = createSignal(false),
    [spectrum, setSpectrum] = createSignal(false),
    [ordinaryLyrics, setOrdinaryLyrics] = createSignal(true),
    [barStyle, setBarStyle] = createSignal<"gradient" | "terminal">("gradient"),
    [scene, setScene] = createSignal<Scene>("sphere"),
    [error, setError] = createSignal("");
  onMount(() => {
    const toggleQueue = () => setQueue((value) => !value);
    window.addEventListener("phemios-queue-toggle", toggleQueue);
    onCleanup(() => window.removeEventListener("phemios-queue-toggle", toggleQueue));
    function restore() {
      setSpectrum(false);
      setOrdinaryLyrics(true);
      setBarStyle("gradient");
      setScene("sphere");
      setError("");
      try {
        const savedBands = interfacePreferences.getItem("phemios.spectrum");
        if (savedBands !== null) {
          const value = JSON.parse(savedBands);
          if (typeof value !== "boolean") throw new Error(t("Préférences invalides."));
          setSpectrum(value);
        }
        const savedStyle = interfacePreferences.getItem("phemios.spectrum-style");
        if (savedStyle) {
          const value = JSON.parse(savedStyle);
          if (!["gradient", "terminal"].includes(value))
            throw new Error(t("Préférences invalides."));
          setBarStyle(value);
        }
        const raw = interfacePreferences.getItem("phemios.visualizer");
        if (raw) {
          const value = JSON.parse(raw);
          if (!["off", "sphere", "waves", "landscape", "floating"].includes(value))
            throw new Error(t("Préférences invalides."));
          setScene(value);
        }
      } catch (failure) {
        setError(String(failure));
      }
    }
    restore();
    window.addEventListener("phemios-settings-loaded", restore);
    onCleanup(() => window.removeEventListener("phemios-settings-loaded", restore));
  });
  const words = createTrackLyrics({
    reference: () => player.current()?.reference ?? "",
    available: () => undefined,
    session: () => library.sessionFor(player.current()?.reference ?? ""),
    jobs: library.tasks.jobs,
    detail: true,
  });
  const lyrics = words.lyrics;
  const [phrase, setPhrase] = createSignal(0);
  const cueTimes = createMemo(() =>
    [
      ...new Set(
        lyrics()?.lines.flatMap((line) => (line.at_ms === null ? [] : [line.at_ms])) ?? [],
      ),
    ].sort((a, b) => a - b),
  );
  createEffect(
    on(
      () => player.current()?.reference,
      () => setPhrase(0),
    ),
  );
  const plain = createMemo(() =>
    lyrics()?.synced === false
      ? lyrics()!
          .lines.map((row) => row.text)
          .filter((text) => text.trim())
      : [],
  );
  const active = () =>
    !!player.current() && ["playing", "paused", "connecting"].includes(player.state().status);
  function choose(value: Scene) {
    try {
      interfacePreferences.setItem("phemios.visualizer", JSON.stringify(value));
      announceSetting("phemios.visualizer", JSON.stringify(value));
      setScene(value);
      setError("");
    } catch (failure) {
      setError(String(failure));
    }
  }
  return (
    <section class="playback-page" classList={{ "queue-open": queue() }}>
      <Show when={!queue() && player.queue().length > 0}>
        <button
          class="icon-button quiet playback-queue-toggle"
          aria-label={t("Afficher ou masquer la liste de lecture")}
          title={t("Afficher ou masquer la liste de lecture")}
          aria-pressed={queue()}
          onClick={() => setQueue(!queue())}
        >
          <Icon name="list" />
        </button>
      </Show>
      <Show
        when={active()}
        fallback={
          <div class="playback-idle">
            <EmptyState icon="visualizer">{t("Aucun morceau en lecture")}</EmptyState>
          </div>
        }
      >
        <div class="playback-stage">
          <header class="playback-view-header">
            <Show when={player.current()?.album}>
              {(album) => (
                <a href={`#/album/${encodeURIComponent(album().reference)}`}>
                  <Artwork album={album()} thumbnail />
                </a>
              )}
            </Show>
            <div>
              <h1>
                <a href={`#/track/${encodeURIComponent(player.current()?.reference ?? "")}`}>
                  {player.current()?.title}
                </a>
              </h1>
              <p>
                <Show when={player.current()?.album?.artist} fallback={player.current()?.artist}>
                  {(artist) => (
                    <a href={`#/artist/${encodeURIComponent(artist())}`}>
                      {player.current()?.artist}
                    </a>
                  )}
                </Show>
              </p>
            </div>
          </header>
          <div class="playback-visuals">
            <div class="scene-controls">
              <For
                each={[
                  { id: "floating" as const, icon: "sparkles", label: t("Paroles flottantes") },
                  { id: "sphere" as const, icon: "globe", label: t("Sphère") },
                  { id: "waves" as const, icon: "wave", label: t("Vagues") },
                  { id: "landscape" as const, icon: "landscape", label: t("Relief") },
                ]}
              >
                {(item) => (
                  <button
                    class="icon-button quiet"
                    title={item.label}
                    aria-label={item.label}
                    aria-pressed={scene() === item.id}
                    onClick={() => choose(scene() === item.id ? "off" : item.id)}
                  >
                    <Icon name={item.icon} />
                  </button>
                )}
              </For>
              <button
                class="icon-button quiet"
                title={t("Afficher ou masquer les paroles normales")}
                aria-label={t("Afficher ou masquer les paroles normales")}
                aria-pressed={ordinaryLyrics()}
                onClick={() => setOrdinaryLyrics(!ordinaryLyrics())}
              >
                <Icon name="lyrics" />
              </button>
              <button
                class="icon-button quiet"
                title={t("Afficher les fréquences")}
                aria-label={t("Afficher les fréquences")}
                aria-pressed={spectrum()}
                disabled={!player.state().spectrum_hz || player.state().device === "@hqplayer"}
                onClick={() => {
                  try {
                    const value = !spectrum();
                    interfacePreferences.setItem("phemios.spectrum", JSON.stringify(value));
                    announceSetting("phemios.spectrum", JSON.stringify(value));
                    setSpectrum(value);
                  } catch (failure) {
                    setError(String(failure));
                  }
                }}
              >
                <Icon name="spectrum" />
              </button>
              <Show when={spectrum()}>
                <button
                  class="icon-button quiet"
                  title={
                    barStyle() === "gradient" ? t("Barres du terminal Aède") : t("Barres dégradées")
                  }
                  aria-label={
                    barStyle() === "gradient" ? t("Barres du terminal Aède") : t("Barres dégradées")
                  }
                  aria-pressed={barStyle() === "terminal"}
                  onClick={() => {
                    try {
                      const next = barStyle() === "gradient" ? "terminal" : "gradient";
                      interfacePreferences.setItem("phemios.spectrum-style", JSON.stringify(next));
                      announceSetting("phemios.spectrum-style", JSON.stringify(next));
                      setBarStyle(next);
                    } catch (failure) {
                      setError(String(failure));
                    }
                  }}
                >
                  <Icon name="terminal" />
                </button>
              </Show>
            </div>
            <Show
              when={
                playbackLayers(scene(), spectrum(), !!player.state().spectrum_hz?.length)
                  .frequencies
              }
            >
              <FrequencyBars
                levels={player.state().spectrum ?? []}
                frequencies={player.state().spectrum_hz ?? []}
                rate={player.state().sample_rate}
                style={barStyle()}
                position={player.seekPosition()}
                reference={player.current()?.reference ?? ""}
                playing={player.state().status === "playing"}
              />
            </Show>
            <Show when={scene() !== "off"}>
              <AudioScene
                scene={scene()}
                playing={player.state().status === "playing"}
                levels={player.state().levels}
              />
            </Show>
            <Show when={plain().length && playbackWords(scene(), ordinaryLyrics())}>
              <div class="untimed-lyrics-controls">
                <button
                  class="icon-button quiet"
                  disabled={phrase() === 0}
                  aria-label={t("Phrase précédente")}
                  onClick={() => setPhrase((value) => value - 1)}
                >
                  <Icon name="previous" />
                </button>
                <small>
                  {t("Paroles non synchronisées")} · {phrase() + 1}/{plain().length}
                </small>
                <button
                  class="icon-button quiet"
                  disabled={phrase() + 1 >= plain().length}
                  aria-label={t("Phrase suivante")}
                  onClick={() => setPhrase((value) => value + 1)}
                >
                  <Icon name="next" />
                </button>
              </div>
            </Show>
            <PlaybackLyrics
              hidden={!playbackWords(scene(), ordinaryLyrics())}
              floating={scene() === "floating"}
              typography={{
                track: player.current()?.reference ?? "",
                phase: lyricAct(
                  lyrics()?.synced === false
                    ? phrase()
                    : cueTimes().indexOf(activeLyricTime(lyrics(), player.seekPosition()) ?? -1),
                  lyrics()?.synced === false ? plain().length : cueTimes().length,
                ),
              }}
              cue={`${player.current()?.reference}:${lyrics()?.synced === false ? phrase() : activeLyricTime(lyrics(), player.seekPosition())}`}
              text={
                lyrics()?.synced === false
                  ? (plain()[phrase()] ?? "")
                  : currentLyricText(lyrics(), player.seekPosition())
              }
            />
          </div>
          <Show when={error()}>
            <p class="notice" role="alert">
              {error()}
            </p>
          </Show>
          <Show when={words.error()}>
            <p class="notice" role="alert">
              {words.error()}
            </p>
          </Show>
        </div>
      </Show>
      <Show when={queue()}>
        <PlaybackQueue onClose={() => setQueue(false)} />
      </Show>
    </section>
  );
}

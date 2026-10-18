import { cdReference } from "../cd/model";
import { UntimedLyricsControls } from "../components/UntimedLyricsControls";
import { createUntimedLyrics } from "../visualizer/untimed-lyrics";
import { PlaybackVisualControls } from "../components/PlaybackVisualControls";
import { interfacePreferences } from "../library/account-preferences";
import { lyricAct } from "../visualizer/lyric-treatment";
import { createMemo, createSignal, Show, onMount, onCleanup } from "solid-js";
import { t } from "../i18n";
import { useLibrary } from "../library/context";
import { createTrackLyrics } from "../library/track-lyrics";
import { announceSetting } from "../library/saved-settings";
import { currentLyricText, activeLyricTime } from "../library/lyrics";
import { playbackLayers, playbackWords, nextFrequencyMode } from "../visualizer/layers";
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
    [floatingLyrics, setFloatingLyrics] = createSignal(true),
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
      setFloatingLyrics(true);
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
  const manual = createUntimedLyrics(() => player.current()?.reference, lyrics),
    phrase = manual.index,
    plain = manual.lines;
  const cueTimes = createMemo(() =>
    [
      ...new Set(
        lyrics()?.lines.flatMap((line) => (line.at_ms === null ? [] : [line.at_ms])) ?? [],
      ),
    ].sort((a, b) => a - b),
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
      <Show when={!queue()}>
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
                <a
                  href={
                    cdReference(player.current()?.reference ?? "")
                      ? "#/cd"
                      : `#/track/${encodeURIComponent(player.current()?.reference ?? "")}`
                  }
                >
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
            <PlaybackVisualControls
              scene={scene()}
              lyricsVisible={playbackWords(scene(), ordinaryLyrics(), floatingLyrics())}
              synced={lyrics()?.synced}
              spectrum={spectrum()}
              barStyle={barStyle()}
              bandsAvailable={
                !!player.state().spectrum_hz?.length && player.state().device !== "@hqplayer"
              }
              onScene={choose}
              onLyrics={() =>
                scene() === "floating"
                  ? setFloatingLyrics(!floatingLyrics())
                  : setOrdinaryLyrics(!ordinaryLyrics())
              }
              onBands={() => {
                try {
                  const next = nextFrequencyMode(spectrum(), barStyle());
                  interfacePreferences.setItem(
                    "phemios.spectrum-style",
                    JSON.stringify(next.style),
                  );
                  interfacePreferences.setItem("phemios.spectrum", JSON.stringify(next.visible));
                  announceSetting("phemios.spectrum-style", JSON.stringify(next.style));
                  announceSetting("phemios.spectrum", JSON.stringify(next.visible));
                  setBarStyle(next.style);
                  setSpectrum(next.visible);
                  setError("");
                } catch (failure) {
                  setError(String(failure));
                }
              }}
            />
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
            <Show
              when={plain().length && playbackWords(scene(), ordinaryLyrics(), floatingLyrics())}
            >
              <UntimedLyricsControls
                index={phrase()}
                total={plain().length}
                previous={manual.previous}
                next={manual.next}
              />
            </Show>
            <PlaybackLyrics
              audio={{
                levels: player.state().spectrum ?? [],
                frequencies: player.state().spectrum_hz ?? [],
                position: player.state().position_ms,
                reference: player.state().reference,
              }}
              playing={player.state().status === "playing"}
              hidden={!playbackWords(scene(), ordinaryLyrics(), floatingLyrics())}
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

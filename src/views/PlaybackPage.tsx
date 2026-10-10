import { createResource, createSignal, For, Show, onMount, onCleanup } from "solid-js";
import { t } from "../i18n";
import { useLibrary } from "../library/context";
import { requestAede } from "../platform/desktop";
import { announceSetting } from "../library/saved-settings";
import { parseLyrics, currentLyricText } from "../library/lyrics";
import { AudioScene } from "../components/AudioScene";
import { EmptyState } from "../components/EmptyState";
import { Icon } from "../components/Icon";
import { Artwork } from "../components/Artwork";
import { referenceSource } from "../library/sources";
import type { Scene } from "../visualizer/particles";
/** Optional playback workspace; the queue and visuals use the same native clock as the footer. */
export function PlaybackPage() {
  const library = useLibrary(),
    player = library.player,
    [queue, setQueue] = createSignal(false),
    [scene, setScene] = createSignal<Scene>("sphere"),
    [visible, setVisible] = createSignal(100),
    [error, setError] = createSignal("");
  onMount(() => {
    function restore() {
      try {
        const raw = localStorage.getItem("phemios.visualizer");
        if (raw) {
          const value = JSON.parse(raw);
          if (!["sphere", "waves", "landscape"].includes(value))
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
  const [words] = createResource(
    () => player.current()?.reference || false,
    async (reference) => {
      try {
        return {
          reference,
          lyrics: parseLyrics(
            await requestAede(
              "/api/v1/lyrics",
              { track: reference },
              "GET",
              null,
              referenceSource(reference),
            ),
            reference,
          ),
        };
      } catch (failure) {
        return { reference, error: String(failure), lyrics: null };
      }
    },
  );
  const lyrics = () =>
    words()?.reference === player.current()?.reference ? words()?.lyrics : undefined;
  const active = () =>
    !!player.current() && ["playing", "paused", "connecting"].includes(player.state().status);
  function choose(value: Scene) {
    try {
      localStorage.setItem("phemios.visualizer", JSON.stringify(value));
      announceSetting("phemios.visualizer", JSON.stringify(value));
      setScene(value);
      setError("");
    } catch (failure) {
      setError(String(failure));
    }
  }
  return (
    <section class="playback-page" classList={{ "queue-open": queue() }}>
      <Show
        when={active()}
        fallback={<EmptyState icon="visualizer">{t("Aucun morceau en lecture")}</EmptyState>}
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
              <h1>{player.current()?.title}</h1>
              <p>{player.current()?.artist}</p>
            </div>
            <Show when={!queue()}>
              <button
                class="icon-button quiet"
                aria-label={t("Afficher ou masquer la liste de lecture")}
                title={t("Afficher ou masquer la liste de lecture")}
                aria-pressed={queue()}
                onClick={() => setQueue(!queue())}
              >
                <Icon name="list" />
              </button>
            </Show>
          </header>
          <div class="scene-controls">
            <For
              each={[
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
                  onClick={() => choose(item.id)}
                >
                  <Icon name={item.icon} />
                </button>
              )}
            </For>
          </div>
          <AudioScene
            scene={scene()}
            playing={player.state().status === "playing"}
            levels={player.state().levels}
          />
          <Show when={error()}>
            <p class="notice" role="alert">
              {error()}
            </p>
          </Show>
          <Show when={words()?.reference === player.current()?.reference && words()?.error}>
            <p class="notice" role="alert">
              {words()?.error}
            </p>
          </Show>
          <p class="playback-current-lyrics">{currentLyricText(lyrics(), player.seekPosition())}</p>
        </div>
        <Show when={queue()}>
          <aside class="playback-queue">
            <div class="page-heading">
              <h2>{t("Liste de lecture")}</h2>
              <button
                class="icon-button quiet icon-close"
                aria-label={t("Fermer")}
                onClick={() => setQueue(false)}
              >
                <Icon name="close" />
              </button>
            </div>
            <ol>
              <For each={player.queue().slice(0, visible())}>
                {(row) => (
                  <li classList={{ current: row.index === player.state().index }}>
                    <button
                      class="queue-track"
                      disabled={player.busy()}
                      onClick={() => void player.action("jump", row.index)}
                    >
                      <small class="queue-track-number">
                        {row.number}/{row.albumTotal}
                      </small>
                      <span>
                        <strong>{row.title}</strong>
                        <small>
                          {row.artist} · {row.album?.title}
                        </small>
                      </span>
                      <span class="queue-track-state">
                        <Show when={row.index === player.state().index}>
                          <Icon name={player.state().status === "playing" ? "volume" : "pause"} />
                        </Show>
                      </span>
                    </button>
                  </li>
                )}
              </For>
            </ol>
            <Show when={player.queue().length > visible()}>
              <button onClick={() => setVisible(visible() + 100)}>{t("Afficher davantage")}</button>
            </Show>
          </aside>
        </Show>
      </Show>
    </section>
  );
}

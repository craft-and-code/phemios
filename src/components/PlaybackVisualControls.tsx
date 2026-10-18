import { For } from "solid-js";
import { t } from "../i18n";
import { Icon } from "./Icon";
import { LyricsIcon } from "./LyricsIcon";
import type { Scene } from "../visualizer/particles";
/** Overlay controls leave scene geometry unchanged; one frequency action cycles all band modes. */
export function PlaybackVisualControls(props: {
  scene: Scene;
  lyricsVisible: boolean;
  synced: boolean | undefined;
  spectrum: boolean;
  barStyle: "gradient" | "terminal";
  bandsAvailable: boolean;
  onScene: (scene: Scene) => void;
  onLyrics: () => void;
  onBands: () => void;
}) {
  const bandsLabel = () =>
    !props.spectrum
      ? t("Afficher les fréquences")
      : props.barStyle === "gradient"
        ? t("Barres du terminal Aède")
        : t("Masquer les fréquences");
  return (
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
            aria-pressed={props.scene === item.id}
            onClick={() => props.onScene(props.scene === item.id ? "off" : item.id)}
          >
            <Icon name={item.icon} />
          </button>
        )}
      </For>
      <button
        class="icon-button quiet"
        title={t("Afficher ou masquer les paroles")}
        aria-label={t("Afficher ou masquer les paroles")}
        aria-pressed={props.lyricsVisible}
        onClick={props.onLyrics}
      >
        <LyricsIcon synced={props.synced} />
      </button>
      <button
        class="icon-button quiet"
        title={bandsLabel()}
        aria-label={bandsLabel()}
        aria-pressed={props.spectrum}
        disabled={!props.bandsAvailable}
        onClick={props.onBands}
      >
        <Icon name={props.spectrum && props.barStyle === "terminal" ? "terminal" : "spectrum"} />
      </button>
    </div>
  );
}

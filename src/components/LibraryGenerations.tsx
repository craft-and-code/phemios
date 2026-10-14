import { For, Show } from "solid-js";
import { t } from "../i18n";
import { ActionButton } from "./ActionButton";
import { Icon } from "./Icon";
import { generationSteps, type GenerationStep } from "../library/generation-policy";
/** Whole-library actions share one admission gate and one loader owned by the active action. */
export function LibraryGenerations(props: {
  enabled: boolean;
  lyricsSupported?: boolean;
  reserved: boolean;
  action?: GenerationStep | "all" | undefined;
  onStart: (steps: readonly GenerationStep[]) => void;
  onCancel: () => void;
  cancellable: boolean;
}) {
  const labels = {
    analyze: t("Analyses FlacCompagnon"),
    spectrum: t("Spectrogrammes"),
    m3u: t("Listes M3U"),
    lyrics: t("Paroles"),
  };
  const icons = {
    analyze: "graph",
    spectrum: "spectrum",
    m3u: "playlist",
    lyrics: "lyrics-download",
  };
  return (
    <div class="library-generations">
      <div class="generation-actions">
        <For each={generationSteps}>
          {(step) => (
            <ActionButton
              icon={icons[step]}
              busy={props.action === step}
              disabled={
                !props.enabled ||
                props.reserved ||
                (step === "lyrics" && props.lyricsSupported === false)
              }
              onClick={() => props.onStart([step])}
            >
              {labels[step]}
            </ActionButton>
          )}
        </For>
        <ActionButton
          icon="layers"
          class="primary"
          busy={props.action === "all"}
          disabled={!props.enabled || props.reserved || props.lyricsSupported === false}
          onClick={() => props.onStart(generationSteps)}
        >
          {t("Tout lancer")}
        </ActionButton>
        <Show when={props.cancellable}>
          <button
            type="button"
            class="icon-button"
            title={t("Arrêter les générations")}
            aria-label={t("Arrêter les générations")}
            onClick={props.onCancel}
          >
            <Icon name="stop" />
          </button>
        </Show>
      </div>
    </div>
  );
}

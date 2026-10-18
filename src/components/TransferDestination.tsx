import type { ComponentProps } from "solid-js";
import { Show, onMount, onCleanup } from "solid-js";
import { t } from "../i18n";
import { PlayersContent } from "./PlayersContent";
import { ActionButton } from "./ActionButton";
import { Feedback } from "./Feedback";
/** Destination controls remain separate from source selection; only an explicit native dialog can grant a folder. */
export function TransferDestination(
  props: ComponentProps<typeof PlayersContent> & {
    canChoose: boolean;
    choosing?: boolean;
    chooseError?: string;
    warning?: string;
    onChoose: () => void;
    onDismissError?: () => void;
  },
) {
  let region!: HTMLElement,
    idleHeight = 0;
  onMount(() => {
    const measure = () => {
      if (!props.busy) idleHeight = region.getBoundingClientRect().height;
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(region);
    onCleanup(() => observer.disconnect());
  });
  return (
    <section
      ref={(element) => {
        region = element;
      }}
      style={
        props.busy && idleHeight
          ? { height: `${idleHeight}px`, "min-height": `${idleHeight}px` }
          : {}
      }
      class="transfer-panel transfer-destination"
      aria-label={t("Périphérique de destination")}
    >
      <div class="page-heading">
        <h3>{t("Périphérique de destination")}</h3>
        <ActionButton
          icon="folder"
          busy={!!props.choosing}
          disabled={!props.canChoose || props.disabled}
          onClick={props.onChoose}
        >
          {t("Choisir un dossier…")}
        </ActionButton>
      </div>
      <Feedback error message={props.chooseError ?? ""} onClose={() => props.onDismissError?.()} />
      <PlayersContent {...props} />
      <Show when={props.warning}>
        <Feedback error persistent message={props.warning!} />
      </Show>
    </section>
  );
}

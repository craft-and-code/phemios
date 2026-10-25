import { createSignal } from "solid-js";
import { t } from "../i18n";
import { Icon } from "./Icon";
/** Playback commands stay independent of detail navigation and reject overlapping activation. */
export function CoverPlayView(props: {
  reference: string;
  title: string;
  class?: string | undefined;
  variant?: "cover" | "detail" | "row" | undefined;
  action?: "play" | "pause" | "resume" | undefined;
  label?: string | undefined;
  disabled?: boolean | undefined;
  onPlay: () => Promise<void>;
}) {
  const [pending, setPending] = createSignal(false);
  async function play(event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    if (pending() || props.disabled) return;
    setPending(true);
    try {
      await props.onPlay();
    } finally {
      setPending(false);
    }
  }
  const label = () =>
    props.label ??
    (props.action === "pause"
      ? t("Mettre en pause")
      : props.action === "resume"
        ? t("Reprendre la lecture")
        : t("Lire {0}", props.title));
  return (
    <button
      class={`icon-button play-action ${props.variant === "detail" ? "detail-play" : props.variant === "row" ? "row-play" : "cover-play"} ${props.class ?? ""}`}
      aria-label={label()}
      title={label()}
      data-play-reference={props.reference}
      data-play-action={props.action ?? "play"}
      aria-busy={pending()}
      disabled={props.disabled || pending()}
      onClick={(event) => void play(event)}
    >
      <Icon name={props.action === "pause" ? "pause" : "play"} />
    </button>
  );
}

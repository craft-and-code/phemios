import { createSignal } from "solid-js";
import { t } from "../i18n";
import { Icon } from "./Icon";
/** Play admission is independent of cover/detail navigation and rejects overlapping starts. */
export function CoverPlayView(props: {
  reference: string;
  title: string;
  class?: string | undefined;
  variant?: "cover" | "detail" | undefined;
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
  return (
    <button
      class={`icon-button ${props.variant === "detail" ? "detail-play" : "cover-play"} ${props.class ?? ""}`}
      aria-label={props.label ?? t("Lire {0}", props.title)}
      title={props.label ?? t("Lire {0}", props.title)}
      data-play-reference={props.reference}
      aria-busy={pending()}
      disabled={props.disabled || pending()}
      onClick={(event) => void play(event)}
    >
      <Icon name="play" />
    </button>
  );
}

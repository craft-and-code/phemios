import { createSignal, Show } from "solid-js";
import { useLibrary } from "../library/context";
import { t } from "../i18n";
import { Icon } from "./Icon";
/** Independent playback action: cover/detail links retain their original navigation. */
export function CoverPlay(props: { reference: string; title: string; class?: string }) {
  const library = useLibrary(),
    [pending, setPending] = createSignal(false);
  async function play(event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    setPending(true);
    try {
      await library.player.startReference(props.reference);
    } finally {
      setPending(false);
    }
  }
  return (
    <button
      class={`icon-button cover-play ${props.class ?? ""}`}
      aria-label={t("Lire {0}", props.title)}
      title={t("Lire {0}", props.title)}
      aria-busy={pending()}
      disabled={
        !library.sessionFor(props.reference) ||
        library.sessionFor(props.reference)?.account.role === "auditor" ||
        library.player.busy()
      }
      onClick={(event) => void play(event)}
    >
      <Show when={pending()} fallback={<Icon name="play" />}>
        <span class="spinner" aria-hidden="true" />
      </Show>
    </button>
  );
}

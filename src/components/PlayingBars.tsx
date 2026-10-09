import { t } from "../i18n";
import { createEffect, createSignal, For, Show } from "solid-js";
import { useLibrary } from "../library/context";
import { equalizerHeights } from "../library/equalizer";
/** Measured RMS with distinct response envelopes and FlacCompagnon's centred dimensions. */
export function PlayingBars(props: { reference: string }) {
  const player = useLibrary().player;
  const [heights, setHeights] = createSignal([0, 0, 0, 0]);
  const selected = () =>
    !!props.reference &&
    player.state().reference === props.reference &&
    ["playing", "paused", "connecting"].includes(player.state().status);
  let reference = "";
  createEffect(() => {
    const state = player.state();
    if (reference !== state.reference || state.status !== "playing") {
      reference = state.reference;
      setHeights([0, 0, 0, 0]);
    } else setHeights((previous) => equalizerHeights(previous, state.level));
  });
  return (
    <Show when={selected()}>
      <span
        class="playing-bars"
        role="img"
        aria-label={
          player.state().status === "playing"
            ? t("Niveau audio du titre en lecture")
            : t("Indicateur audio en pause")
        }
      >
        <For each={[0, 1, 2, 3]}>
          {(i) => (
            <span
              style={{
                height: `${player.state().status === "playing" ? 3 + (heights()[i] ?? 0) * 9 : 2}px`,
              }}
            />
          )}
        </For>
      </span>
    </Show>
  );
}

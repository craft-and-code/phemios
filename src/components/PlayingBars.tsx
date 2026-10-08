import { For, Show } from "solid-js";
import { useLibrary } from "../library/context";
/** Stereo level bars use consumed native PCM RMS/peak pairs, never an invented animation. */
export function PlayingBars(props: { reference: string }) {
  const player = useLibrary().player;
  const active = () =>
    player.state().status === "playing" && player.state().reference === props.reference;
  return (
    <Show when={active()}>
      <span class="playing-bars" role="img" aria-label="Niveaux audio du titre en lecture">
        <For each={[0, 1, 2, 3]}>
          {(i) => (
            <span
              style={{ height: `${Math.max(2, Math.sqrt(player.state().levels[i] ?? 0) * 100)}%` }}
            />
          )}
        </For>
      </span>
    </Show>
  );
}

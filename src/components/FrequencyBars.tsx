import { For } from "solid-js";
/** Decorative native stereo band energies, never interpolated from the four peak/RMS meters. */
export function FrequencyBars(props: {
  levels: readonly number[];
  frequencies: readonly number[];
  rate: number;
}) {
  return (
    <div class="frequency-backdrop" aria-hidden="true">
      <For each={props.frequencies}>
        {(hz, i) => (
          <div classList={{ "band-unavailable": hz >= props.rate * 0.45 }}>
            <span
              class="frequency-bar"
              style={{ transform: `scaleY(${Math.max(0.015, props.levels[i()] ?? 0)})` }}
            />
            <small>
              {hz >= 1000 ? `${(hz / 1000).toFixed(hz < 10000 ? 1 : 0)}k` : Math.round(hz)}
            </small>
          </div>
        )}
      </For>
    </div>
  );
}

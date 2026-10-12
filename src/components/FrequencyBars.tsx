import { createMemo, For, Index, Show } from "solid-js";
import { createTerminalBands } from "../visualizer/terminal-bands";
/** Consumed frequency energies with optional Aède terminal segmentation and held peaks. */
export function FrequencyBars(props: {
  levels: readonly number[];
  frequencies: readonly number[];
  rate: number;
  style?: "gradient" | "terminal";
  position: number;
  reference: string;
  playing: boolean;
}) {
  const meter = createTerminalBands();
  const rows = createMemo(() =>
    meter.observe(props.playing ? props.levels : undefined, props.position, props.reference),
  );
  const frequency = (hz: number) =>
    hz >= 1000 ? `${(hz / 1000).toFixed(hz < 10000 ? 1 : 0)}k` : String(Math.round(hz));
  return (
    <div
      class="frequency-backdrop"
      classList={{ "terminal-backdrop": props.style === "terminal" }}
      aria-hidden="true"
    >
      <Show
        when={props.style === "terminal"}
        fallback={
          <For each={props.frequencies}>
            {(hz, i) => (
              <div classList={{ "band-unavailable": hz >= props.rate * 0.45 }}>
                <span
                  class="frequency-bar"
                  style={{ transform: `scaleY(${Math.max(0.015, props.levels[i()] ?? 0)})` }}
                />
                <small>{frequency(hz)}</small>
              </div>
            )}
          </For>
        }
      >
        <Index each={rows()}>
          {(band, i) => (
            <div
              classList={{
                "band-unavailable": (props.frequencies[i] ?? 0) >= props.rate * 0.45,
              }}
            >
              <span class="terminal-band">
                <For each={[9, 8, 7, 6, 5, 4, 3, 2, 1, 0]}>
                  {(row) => (
                    <i
                      classList={{
                        lit: row < Math.round(band().level * 10),
                        peak: band().peak > 0 && row === Math.min(9, Math.floor(band().peak * 10)),
                      }}
                    />
                  )}
                </For>
              </span>
              <small>{frequency(props.frequencies[i] ?? 0)}</small>
            </div>
          )}
        </Index>
      </Show>
    </div>
  );
}

import { For, createMemo } from "solid-js";
import { shiftInterval } from "../library/filtering";
import type { Interval } from "../library/types";
import type { CountBin } from "../library/distribution";

interface Props {
  label: string;
  domain: Interval;
  value: Interval;
  ticks: readonly number[];
  format: (value: number) => string;
  onChange: (value: Interval) => void;
  bins: readonly CountBin[];
  countLabel: string;
}

/** Two native bounds plus a draggable/keyboard-movable selected band. */
export function RangeRail(props: Props) {
  let track: HTMLDivElement | undefined;
  let drag: { x: number; range: Interval; width: number } | undefined;
  const span = () => props.domain[1] - props.domain[0];
  const position = (value: number) =>
    span() === 0 ? 0 : ((value - props.domain[0]) / span()) * 100;
  const label = createMemo(
    () => `${props.format(props.value[0])} — ${props.format(props.value[1])}`,
  );
  const histogram = createMemo(() => {
    const lookup = new Map(props.bins.map((bin) => [bin.value, bin.count]));
    const maximum = Math.max(1, ...props.bins.map((bin) => bin.count));
    return Array.from({ length: span() + 1 }, (_, index) => {
      const value = props.domain[0] + index;
      const count = lookup.get(value) ?? 0;
      return { value, count, height: count === 0 ? 2 : 4 + (count / maximum) * 26 };
    });
  });

  function start(event: PointerEvent & { currentTarget: HTMLButtonElement }) {
    if (event.button !== 0 || !track) return;
    drag = { x: event.clientX, range: props.value, width: track.clientWidth };
    event.currentTarget.setPointerCapture(event.pointerId);
    event.currentTarget.focus();
    event.preventDefault();
  }

  function move(event: PointerEvent) {
    if (!drag || !drag.width) return;
    props.onChange(
      shiftInterval(drag.range, ((event.clientX - drag.x) / drag.width) * span(), props.domain),
    );
  }

  function keyboard(event: KeyboardEvent) {
    const deltas: Record<string, number> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      Home: -span(),
      End: span(),
    };
    const delta = deltas[event.key];
    if (delta === undefined) return;
    event.preventDefault();
    props.onChange(shiftInterval(props.value, delta, props.domain));
  }

  return (
    <section class="range-rail" aria-label={props.label}>
      <div class="rail-heading">
        <span>{props.label}</span>
        <output>{label()}</output>
        <small>Glissez la plage ou ses bornes</small>
      </div>
      <div
        class="rail-track"
        ref={(element) => {
          track = element;
        }}
      >
        <div class="rail-histogram" aria-label={`Répartition par ${props.label.toLowerCase()}`}>
          <For each={histogram()}>
            {(bin) => (
              <div
                class="histogram-bin"
                classList={{ selected: bin.value >= props.value[0] && bin.value <= props.value[1] }}
                role="img"
                aria-label={`${props.format(bin.value)} : ${bin.count} ${props.countLabel}`}
                title={`${props.format(bin.value)} · ${bin.count} ${props.countLabel}`}
                style={{ height: `${bin.height}px` }}
              />
            )}
          </For>
        </div>
        <div class="rail-line" />
        <button
          class="rail-band"
          type="button"
          aria-label={`Déplacer la sélection ${props.label}`}
          style={{
            left: `${position(props.value[0])}%`,
            width: `${position(props.value[1]) - position(props.value[0])}%`,
          }}
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={() => {
            drag = undefined;
          }}
          onPointerCancel={() => {
            drag = undefined;
          }}
          onLostPointerCapture={() => {
            drag = undefined;
          }}
          onKeyDown={keyboard}
        />
        <input
          type="range"
          min={props.domain[0]}
          max={props.domain[1]}
          step="1"
          value={props.value[0]}
          aria-label={`${props.label} : début`}
          onInput={(event) =>
            props.onChange([
              Math.min(Number(event.currentTarget.value), props.value[1]),
              props.value[1],
            ])
          }
        />
        <input
          type="range"
          min={props.domain[0]}
          max={props.domain[1]}
          step="1"
          value={props.value[1]}
          aria-label={`${props.label} : fin`}
          onInput={(event) =>
            props.onChange([
              props.value[0],
              Math.max(Number(event.currentTarget.value), props.value[0]),
            ])
          }
        />
      </div>
      <div class="rail-ticks">
        <For each={props.ticks}>
          {(tick) => (
            <button
              type="button"
              style={{ left: `${position(tick)}%` }}
              classList={{
                "rail-edge-start": tick === props.domain[0],
                "rail-edge-end": tick === props.domain[1],
              }}
              aria-label={`${props.label} : sélectionner ${props.format(tick)}`}
              onClick={() => props.onChange([tick, tick])}
            >
              {props.format(tick)}
            </button>
          )}
        </For>
      </div>
    </section>
  );
}

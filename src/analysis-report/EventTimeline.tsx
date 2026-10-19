import { createEffect, createSignal, createUniqueId, For, Show } from "solid-js";
import type { Event } from "./measurements";
import type { ReportTranslate } from "./presentation";
/** Retained positions use one shared time axis; hover, keyboard and click/touch reveal exact evidence. */
export function EventTimeline(props: {
  events: readonly Event[];
  duration: number;
  locale: string;
  tr: ReportTranslate;
}) {
  const id = createUniqueId();
  const [pinned, setPinned] = createSignal<number>(),
    [hovered, setHovered] = createSignal<number>(),
    [focused, setFocused] = createSignal<number>();
  const active = () => props.events[pinned() ?? hovered() ?? focused() ?? -1];
  const close = () => {
    setPinned(undefined);
    setHovered(undefined);
    setFocused(undefined);
  };
  createEffect(() => {
    void props.events;
    close();
  });
  const number = (value: number) =>
    value.toLocaleString(props.locale, { maximumFractionDigits: 6 });
  const axisTime = (value: number) => {
    const hundredths = Math.round(value * 100);
    return `${Math.floor(hundredths / 6000)}:${((hundredths % 6000) / 100).toLocaleString(props.locale, { minimumIntegerDigits: 2, maximumFractionDigits: 2 })}`;
  };
  const describe = (event: Event) =>
    `${props.tr(event.kind)} · ${number(event.start)} s · ${props.tr("Durée")} : ${number(event.duration)} s · ${props.tr("Canal")} ${event.channel}`;
  const x = (event: Event) => (event.start / props.duration) * 600;
  const toggle = (index: number) => {
    if (pinned() === index) close();
    else setPinned(index);
  };
  return (
    <figure
      class="far-events"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          close();
        }
      }}
    >
      <svg
        viewBox="0 0 600 44"
        preserveAspectRatio="none"
        role="group"
        aria-label={props.tr(
          "Positions conservées des clics et coupures sur {0} secondes",
          props.duration.toLocaleString(props.locale, { maximumFractionDigits: 2 }),
        )}
      >
        <line x1="0" y1="22" x2="600" y2="22" />
        <For each={props.events}>
          {(event, index) => (
            <g
              role="button"
              tabindex="0"
              aria-label={describe(event)}
              aria-pressed={pinned() === index()}
              aria-describedby={active() === event ? id : undefined}
              onClick={() => toggle(index())}
              onPointerEnter={(pointer) => {
                if (pointer.pointerType === "mouse") setHovered(index());
              }}
              onPointerLeave={() => setHovered(undefined)}
              onFocus={() => setFocused(index())}
              onBlur={() => setFocused(undefined)}
              onKeyDown={(key) => {
                if (key.key === "Enter" || key.key === " ") {
                  key.preventDefault();
                  toggle(index());
                }
              }}
            >
              <rect
                class="far-event-hit"
                x={Math.min(582, Math.max(0, x(event) - 9))}
                y={event.kind === "Clic" ? 0 : 22}
                width="18"
                height="22"
              />
              <rect
                x={Math.min(598, x(event))}
                y={event.kind === "Clic" ? 5 : 25}
                width={Math.min(
                  600 - Math.min(598, x(event)),
                  Math.max(2, (event.duration / props.duration) * 600),
                )}
                height="14"
              />
            </g>
          )}
        </For>
      </svg>
      <figcaption>
        <span>0:00</span>
        <span>{axisTime(props.duration)}</span>
      </figcaption>
      <output id={id} role="status" class="far-event-detail">
        <Show when={active()}>{(event) => describe(event())}</Show>
      </output>
    </figure>
  );
}

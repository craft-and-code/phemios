import { createEffect, createSignal, createUniqueId, onCleanup, Show } from "solid-js";
/** Mouse/focus hints can be pinned by click/touch and dismissed by a second click, Escape or outside touch. */
export function MeasurementMarker(props: {
  position: number;
  label: string;
  value: string;
  help: string;
}) {
  const id = createUniqueId();
  let root!: HTMLDivElement;
  const [hovered, setHovered] = createSignal(false),
    [focused, setFocused] = createSignal(false),
    [pinned, setPinned] = createSignal(false),
    [dismissed, setDismissed] = createSignal(false);
  const visible = () => !dismissed() && (hovered() || focused() || pinned());
  const close = () => {
    setPinned(false);
    setDismissed(true);
  };
  createEffect(() => {
    if (!pinned()) return;
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.contains(event.target)) close();
    };
    document.addEventListener("pointerdown", outside);
    onCleanup(() => document.removeEventListener("pointerdown", outside));
  });
  return (
    <div
      class="far-marker-hint"
      ref={(element) => {
        root = element;
      }}
    >
      <button
        type="button"
        class="far-rail-button"
        aria-label={`${props.label} : ${props.value}`}
        aria-describedby={visible() ? id : undefined}
        aria-pressed={pinned()}
        onPointerEnter={(event) => {
          if (event.pointerType === "mouse") {
            setHovered(true);
            setDismissed(false);
          }
        }}
        onPointerLeave={() => setHovered(false)}
        onFocus={() => {
          setFocused(true);
          setDismissed(false);
        }}
        onBlur={() => {
          setFocused(false);
          setPinned(false);
          setDismissed(true);
        }}
        onClick={() => {
          if (pinned()) close();
          else {
            setPinned(true);
            setDismissed(false);
          }
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            close();
          }
        }}
      >
        <span class="far-scale" aria-hidden="true">
          <i style={{ left: `${Math.max(0, Math.min(100, props.position))}%` }} />
        </span>
      </button>
      <Show when={visible()}>
        <span class="far-measure-tooltip" id={id} role="tooltip">
          <strong>
            {props.label} : {props.value}
          </strong>
          <span>{props.help}</span>
        </span>
      </Show>
    </div>
  );
}

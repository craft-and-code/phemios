import { createSignal, onCleanup } from "solid-js";
import { shiftInterval } from "../library/filtering";
import type { Interval } from "../library/types";

/** Follow one selected band outside its hit area, preserving its initial span and owner. */
export function createRangeRailDrag(options: {
  track: () => HTMLElement | undefined;
  value: () => Interval;
  domain: () => Interval;
  change: (value: Interval) => void;
}) {
  const [dragging, setDragging] = createSignal(false);
  let held:
    | {
        pointer: number;
        track: HTMLElement;
        x: number;
        width: number;
        range: Interval;
        domain: Interval;
        last: Interval;
      }
    | undefined;

  function cancel() {
    const old = held;
    if (!old) return;
    held = undefined;
    document.removeEventListener("pointermove", move, true);
    document.removeEventListener("pointerup", finish, true);
    document.removeEventListener("pointercancel", interrupted, true);
    document.removeEventListener("keydown", keyboard, true);
    window.removeEventListener("blur", cancel);
    if (old.track.hasPointerCapture?.(old.pointer)) old.track.releasePointerCapture(old.pointer);
    setDragging(false);
  }

  function update(event: PointerEvent) {
    const drag = held;
    if (!drag || event.pointerId !== drag.pointer) return;
    const domain = options.domain(),
      value = options.value();
    if (
      domain[0] !== drag.domain[0] ||
      domain[1] !== drag.domain[1] ||
      value[0] !== drag.last[0] ||
      value[1] !== drag.last[1]
    ) {
      cancel();
      return;
    }
    const range = shiftInterval(
      drag.range,
      ((event.clientX - drag.x) / drag.width) * (drag.domain[1] - drag.domain[0]),
      drag.domain,
    );
    event.preventDefault();
    if (range[0] === drag.last[0] && range[1] === drag.last[1]) return;
    drag.last = range;
    options.change(range);
  }

  function move(event: PointerEvent) {
    if (event.pointerId !== held?.pointer) return;
    if (!(event.buttons & 1)) cancel();
    else update(event);
  }
  function finish(event: PointerEvent) {
    if (event.pointerId !== held?.pointer || event.button !== 0) return;
    try {
      update(event);
    } finally {
      cancel();
    }
  }
  function interrupted(event: PointerEvent) {
    if (event.pointerId === held?.pointer) cancel();
  }
  function keyboard(event: KeyboardEvent) {
    if (event.key !== "Escape") return;
    event.preventDefault();
    event.stopPropagation();
    cancel();
  }
  function start(event: PointerEvent & { currentTarget: HTMLElement }) {
    const track = options.track(),
      width = track?.getBoundingClientRect().width;
    if (
      held ||
      event.button !== 0 ||
      event.isPrimary === false ||
      !track ||
      !width ||
      !Number.isFinite(width) ||
      width < 0
    )
      return;
    const domain = options.domain(),
      range = options.value();
    if (domain[0] === domain[1]) return;
    held = {
      pointer: event.pointerId,
      track,
      x: event.clientX,
      width,
      range: [range[0], range[1]],
      domain: [domain[0], domain[1]],
      last: [range[0], range[1]],
    };
    document.addEventListener("pointermove", move, { capture: true, passive: false });
    document.addEventListener("pointerup", finish, true);
    document.addEventListener("pointercancel", interrupted, true);
    document.addEventListener("keydown", keyboard, true);
    window.addEventListener("blur", cancel);
    // Capture the stationary track. Document listeners also cover capture loss or unavailable capture.
    try {
      track.setPointerCapture(event.pointerId);
    } catch {
      /* Continue tracking this pointer in the document. */
    }
    event.currentTarget.focus({ preventScroll: true });
    event.preventDefault();
    setDragging(true);
  }
  onCleanup(cancel);
  return { start, cancel, dragging };
}

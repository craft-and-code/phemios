import { batch, createEffect, onCleanup } from "solid-js";
import type { Station } from "./directory";
interface Options {
  stations: () => readonly Station[];
  selected: () => number;
  select: (index: number) => void;
  station: () => Station | undefined;
  status: () => string;
  /** Each explicit transport action replaces a pending dial commitment. */
  revision: () => number;
  pause: () => void;
  /** Stop optional local feedback when a gesture loses its transport ownership. */
  cancelled?: () => void;
  /** The existing transport owns stream resolution and visible playback failures. */
  start: (station: Station) => Promise<void>;
}
/** Commit only the final explicit dial/row choice, including from idle.
 * An actual pointer drag interrupts an engaged stream once; cancellation leaves it paused.
 * Directory replacement, later transport actions and disposal refuse stale commitments.
 */
export function createRadioTuner(options: Options) {
  let alive = true,
    suppressed = false,
    gesture:
      | {
          rows: readonly Station[];
          station: Station | undefined;
          revision: number;
          engaged: boolean;
          interrupted: boolean;
          manual: boolean;
          next?: Station;
        }
      | undefined;
  const engaged = () => ["playing", "connecting"].includes(options.status());
  const cancel = () => {
    if (gesture) {
      suppressed = true;
      options.cancelled?.();
    }
    gesture = undefined;
  };
  const valid = (held: NonNullable<typeof gesture>) =>
    held.rows === options.stations() &&
    held.station === options.station() &&
    held.revision === options.revision() &&
    (!held.engaged || held.interrupted || engaged());
  createEffect(() => {
    options.stations();
    options.station();
    options.revision();
    options.status();
    if (gesture && !valid(gesture)) cancel();
  });
  onCleanup(() => {
    alive = false;
    cancel();
  });
  function begin(manual = true) {
    if (manual) suppressed = false;
    if (!alive || gesture || suppressed) return;
    const rows = options.stations(),
      next = rows[options.selected()];
    gesture = {
      rows,
      station: options.station(),
      revision: options.revision(),
      engaged: engaged(),
      interrupted: false,
      manual,
      ...(next ? { next } : {}),
    };
  }
  function preview(index: number) {
    if (!alive || suppressed || !Number.isSafeInteger(index)) return;
    const next = options.stations()[index];
    if (!next) return;
    begin(false);
    options.select(index);
    if (gesture) gesture.next = next;
  }
  function interrupt() {
    const held = gesture;
    if (!alive || !held || held.interrupted || !valid(held)) return;
    batch(() => {
      held.interrupted = true;
      if (engaged()) options.pause();
      held.revision = options.revision();
    });
  }
  function finish() {
    const held = gesture;
    gesture = undefined;
    suppressed = false;
    if (held) options.cancelled?.();
    if (
      !alive ||
      !held?.next ||
      !valid(held) ||
      (held.next.uuid === options.station()?.uuid && engaged())
    )
      return;
    void options.start(held.next);
  }
  function choose(index: number) {
    if (!Number.isSafeInteger(index) || !options.stations()[index]) return;
    cancel();
    begin();
    preview(index);
    finish();
  }
  return {
    begin,
    preview,
    interrupt,
    finish,
    cancel,
    choose,
    change() {
      // Pointer/key input commits on release; an accessibility input/change pair has no gesture key.
      if (suppressed) {
        suppressed = false;
        return;
      }
      if (gesture && !gesture.manual) finish();
    },
  };
}
/** Native range keys adjust station selection; other shortcuts retain their usual meaning. */
export function radioTuningKey(key: string) {
  return [
    "ArrowLeft",
    "ArrowRight",
    "ArrowUp",
    "ArrowDown",
    "Home",
    "End",
    "PageUp",
    "PageDown",
  ].includes(key);
}

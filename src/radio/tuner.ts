import { createEffect, onCleanup } from "solid-js";
import type { Station } from "./directory";
interface Options {
  stations: () => readonly Station[];
  select: (index: number) => void;
  station: () => Station | undefined;
  status: () => string;
  /** The existing transport owns stream resolution and visible playback failures. */
  start: (station: Station) => Promise<void>;
}
/** Preview one pointer/key gesture, then retune only an already engaged radio on release.
 * Directory replacement, pause/stop, later transport actions and disposal discard old gestures.
 * No directory request or Aède account is needed; idle selections remain silent.
 */
export function createRadioTuner(options: Options) {
  let alive = true,
    gesture:
      | {
          rows: readonly Station[];
          station: Station | undefined;
          engaged: boolean;
          manual: boolean;
          next?: Station;
        }
      | undefined;
  const engaged = () => ["playing", "connecting"].includes(options.status());
  const cancel = () => {
    gesture = undefined;
  };
  createEffect(() => {
    const rows = options.stations(),
      station = options.station(),
      active = engaged();
    if (gesture && (gesture.rows !== rows || gesture.station !== station || !active)) cancel();
  });
  onCleanup(() => {
    alive = false;
    cancel();
  });
  function begin(manual = true) {
    if (!alive || gesture) return;
    gesture = { rows: options.stations(), station: options.station(), engaged: engaged(), manual };
  }
  function preview(index: number) {
    if (!alive || !Number.isSafeInteger(index)) return;
    const next = options.stations()[index];
    if (!next) return;
    begin(false);
    options.select(index);
    if (gesture) gesture.next = next;
  }
  function finish() {
    const held = gesture;
    cancel();
    if (
      !alive ||
      !held?.engaged ||
      !held.next ||
      !engaged() ||
      held.rows !== options.stations() ||
      held.station !== options.station() ||
      held.next.uuid === options.station()?.uuid
    )
      return;
    void options.start(held.next);
  }
  function choose(index: number) {
    cancel();
    begin();
    preview(index);
    finish();
  }
  return {
    begin,
    preview,
    finish,
    cancel,
    choose,
    change() {
      // Pointer/key input commits on release; an accessibility input/change pair has no gesture key.
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

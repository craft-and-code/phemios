import { createSignal, createEffect, createMemo, untrack } from "solid-js";
import type { Filters, Album, Interval } from "./types";
import { labelYearDomain } from "./label-browsing";
const defaults = (): Filters => ({
  mode: "years",
  years: [0, 0],
  alphabet: [0, 26],
  includeUnknownYear: true,
  query: "",
});
/** Label navigation/login replacement resets intervals; edits survive unchanged-label refreshes. */
export function createLabelSelection(
  scope: () => unknown,
  albums: () => readonly Album[],
  ready: () => boolean,
) {
  const identity = createMemo(scope);
  const [filters, setFilters] = createSignal<Filters>(defaults());
  const [reverse, setReverse] = createSignal(false);
  let held: unknown = Symbol(),
    domain: Interval | undefined;
  createEffect(() => {
    const key = identity();
    if (key !== held) {
      held = key;
      domain = undefined;
      setFilters(defaults());
      setReverse(false);
    }
    if (ready()) {
      const next = labelYearDomain(albums()),
        value = untrack(filters);
      if (!domain || domain[0] !== next[0] || domain[1] !== next[1]) {
        const follows = !domain || (value.years[0] === domain[0] && value.years[1] === domain[1]);
        const years: Interval = follows
          ? next
          : [
              Math.max(next[0], Math.min(next[1], value.years[0])),
              Math.max(next[0], Math.min(next[1], value.years[1])),
            ];
        domain = next;
        setFilters({ ...value, years });
      }
    }
  });
  return { filters, setFilters, reverse, setReverse };
}

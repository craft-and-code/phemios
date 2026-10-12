import { batch, createMemo, createEffect, createSignal, on } from "solid-js";
import { blankSearch } from "./advanced-search";
import { combinedTrackReader } from "./combined-tracks";
export type SearchResult = Awaited<ReturnType<ReturnType<typeof combinedTrackReader>>>;
/** One account/session-scoped search survives route disposal; no result enters disk/public cache. */
export function createRetainedSearch(scope: () => string) {
  const identity = createMemo(scope);
  const [criteria, setCriteria] = createSignal(blankSearch());
  const [submitted, setSubmitted] = createSignal<{ expression: string }>();
  const [offset, setOffset] = createSignal(0);
  let stored:
    { scope: string; expression: string; offset: number; result: SearchResult } | undefined;
  function reset() {
    batch(() => {
      setCriteria(blankSearch());
      setSubmitted(undefined);
      setOffset(0);
      stored = undefined;
    });
  }
  createEffect(on(identity, reset));
  return {
    criteria,
    setCriteria,
    submitted,
    setSubmitted,
    offset,
    setOffset,
    reset,
    /** Explicit submissions refresh even unchanged criteria; remounts keep their confirmed window. */
    submit(expression: string) {
      batch(() => {
        stored = undefined;
        setSubmitted({ expression });
        setOffset(0);
      });
    },
    cached(expression: string, at: number) {
      return stored?.scope === identity() &&
        stored.expression === expression &&
        stored.offset === at
        ? stored.result
        : undefined;
    },
    remember(
      held: string,
      expression: string,
      at: number,
      result: SearchResult,
      request = submitted(),
    ) {
      if (
        held === identity() &&
        request === submitted() &&
        submitted()?.expression === expression &&
        offset() === at
      )
        stored = { scope: held, expression, offset: at, result };
    },
    scope: identity,
  };
}

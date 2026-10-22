import { batch, createEffect, createMemo, createSignal, on, onCleanup, untrack } from "solid-js";
import { createDiagnosticRead } from "./diagnostic-read";
import { searchQueue, type QueueCategory, type QueueSearchScope } from "./queue-search";
/** Search owns a debounced scope independently of playback polling and admitted additions. */
export function createQueueSearch(
  context: () => Omit<QueueSearchScope, "category" | "query" | "offset">,
  request: Parameters<typeof searchQueue>[1],
) {
  const input = createMemo(context);
  const owners = createMemo(() => input().owners, undefined, {
    equals: (before, after) =>
      before.length === after.length &&
      before.every(
        (row, index) =>
          row.source === after[index]?.source && row.session === after[index]?.session,
      ),
  });
  const [owner, setOwner] = createSignal(owners());
  const [query, setQuery] = createSignal(""),
    [term, setTerm] = createSignal(""),
    [category, setCategory] = createSignal<QueueCategory>("tracks"),
    [offset, setOffset] = createSignal(0);
  let timer: ReturnType<typeof setTimeout> | undefined;
  const stopTimer = () => clearTimeout(timer);
  createEffect(
    on(
      owners,
      (next) => {
        stopTimer();
        batch(() => {
          setQuery("");
          setTerm("");
          setOffset(0);
          setOwner(next);
        });
      },
      { defer: true },
    ),
  );
  createEffect(() => {
    const text = query().trim();
    stopTimer();
    if (text === untrack(term)) return;
    timer = setTimeout(
      () =>
        batch(() => {
          setTerm(text);
          setOffset(0);
        }),
      250,
    );
    onCleanup(stopTimer);
  });
  const scope = createMemo(() => ({
    ...input(),
    category: category(),
    query: term(),
    offset: offset(),
  }));
  const read = createDiagnosticRead(
    () =>
      owner() === owners() &&
      (["all", "albums", "artists"].includes(scope().category) || scope().owners.length > 0) &&
      query().trim() === term()
        ? scope()
        : false,
    (input, admission) => searchQueue(input, request, admission.current),
  );
  return {
    query: () => (owner() === owners() ? query() : ""),
    setQuery,
    category,
    offset,
    setOffset,
    read,
    waiting: () => query().trim() !== term(),
    chooseCategory(value: QueueCategory) {
      stopTimer();
      batch(() => {
        setCategory(value);
        setTerm(query().trim());
        setOffset(0);
      });
    },
    submit() {
      stopTimer();
      batch(() => {
        setTerm(query().trim());
        setOffset(0);
      });
    },
  };
}

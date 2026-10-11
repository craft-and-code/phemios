import { createSignal } from "solid-js";
/** The active action owns its indicator; overlapping native dialogs are never submitted. */
export function createPendingAction<Action extends string>() {
  const [pending, setPending] = createSignal<Action>();
  return {
    pending,
    async run<Result>(action: Action, task: () => Promise<Result>): Promise<Result | undefined> {
      if (pending() !== undefined) return undefined;
      setPending(() => action);
      try {
        return await task();
      } finally {
        setPending(undefined);
      }
    },
  };
}

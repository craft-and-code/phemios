import { createEffect, createSignal, on, onCleanup } from "solid-js";
/** Local export metadata and feedback belong to one exact owner/target projection.
 * Replaced projections hide synchronously; captured actions cannot revive them after a round trip.
 */
export function createExportState<Scope, File>(scope: () => Scope) {
  const [state, setState] = createSignal<{
    held: Scope;
    file?: File;
    busy: boolean;
    message: string;
    failed: boolean;
  }>();
  let alive = true,
    generation = 0;
  createEffect(
    on(scope, () => {
      generation++;
      setState(undefined);
    }),
  );
  onCleanup(() => {
    alive = false;
    generation++;
  });
  const visible = () => {
    const value = state();
    return alive && value?.held === scope() ? value : undefined;
  };
  return {
    file: () => visible()?.file,
    busy: () => visible()?.busy ?? false,
    message: () => visible()?.message ?? "",
    failed: () => visible()?.failed ?? false,
    dismiss: () => {
      if (visible()) setState((value) => value && { ...value, message: "", failed: false });
    },
    begin() {
      if (!alive || visible()?.busy) return;
      const held = scope(),
        previous = visible(),
        epoch = ++generation;
      const current = () => alive && epoch === generation && held === scope();
      setState({
        held,
        ...(previous?.file === undefined ? {} : { file: previous.file }),
        busy: true,
        message: "",
        failed: false,
      });
      return {
        scope: held,
        current,
        file(file: File) {
          if (current()) setState((value) => value && { ...value, file });
        },
        feedback(message: string, failed = false) {
          if (current()) setState((value) => value && { ...value, message, failed });
        },
        finish() {
          if (current()) setState((value) => value && { ...value, busy: false });
        },
      };
    },
  };
}

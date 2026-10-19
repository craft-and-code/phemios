import { createMemo, createSignal, onCleanup } from "solid-js";
import { t } from "../i18n";
import type { SourceId } from "./sources";
import type { AccountSession } from "./server";
import type { GenerationStep } from "./generation-policy";
import type { Job } from "./jobs";
/** Generation command feedback belongs to its settings view, not the server-owned job. */
export function createGenerationActions(options: {
  source: () => SourceId;
  session: (source: SourceId) => AccountSession | undefined;
  active: () => Job | undefined;
  start: (source: SourceId, steps: readonly GenerationStep[]) => Promise<unknown>;
  cancel: (id: number, source: SourceId) => Promise<unknown>;
}) {
  const scope = createMemo(() => ({
    source: options.source(),
    local: options.session("local"),
    server: options.session("server"),
  }));
  const [diagnostic, setDiagnostic] = createSignal<{
    scope: ReturnType<typeof scope>;
    message: string;
  }>();
  let alive = true,
    serial = 0;
  onCleanup(() => {
    alive = false;
    serial++;
  });
  async function run(work: () => Promise<unknown>, fallback: string) {
    if (!alive) return;
    const held = scope(),
      ticket = ++serial;
    setDiagnostic(undefined);
    try {
      await work();
    } catch (failure) {
      if (alive && ticket === serial && held === scope())
        setDiagnostic({
          scope: held,
          message: failure instanceof Error ? failure.message : fallback,
        });
    }
  }
  return {
    error: () => (alive && diagnostic()?.scope === scope() ? diagnostic()!.message : ""),
    start(steps: readonly GenerationStep[]) {
      const source = options.source();
      return run(() => options.start(source, steps), t("Lancement impossible."));
    },
    async cancel() {
      const job = options.active();
      if (job)
        await run(
          () => options.cancel(job.task_id, job.source ?? "server"),
          t("Annulation impossible."),
        );
    },
  };
}

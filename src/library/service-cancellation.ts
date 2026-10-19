import { createPersonalActions } from "./personal-actions";
import { createSignal } from "solid-js";
import type { AccountSession } from "./server";
import type { SourceId } from "./sources";
/** Cancellation diagnostics are distinct from device-wide service-key confirmations. */
export function createServiceCancellation(options: {
  session: (source: SourceId) => AccountSession | undefined;
  cancel: (id: number, source: SourceId) => Promise<void>;
}) {
  const [diagnostic, setDiagnostic] = createSignal<{ source: SourceId; message: string }>();
  const admission = (source: SourceId) =>
    createPersonalActions(
      () => "settings",
      () => options.session(source),
      () => source,
      () => {
        if (diagnostic()?.source === source) setDiagnostic(undefined);
      },
    );
  const admissions = { local: admission("local"), server: admission("server") };
  let serial = 0;
  return {
    error: () => diagnostic()?.message ?? "",
    clear: () => setDiagnostic(undefined),
    async cancel(id: number, source: SourceId) {
      const current = admissions[source].capture(),
        ticket = ++serial;
      if (!current()) return;
      setDiagnostic(undefined);
      try {
        await options.cancel(id, source);
      } catch (failure) {
        if (current() && ticket === serial) setDiagnostic({ source, message: String(failure) });
      }
    },
  };
}

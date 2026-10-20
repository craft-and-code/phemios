import { createEffect, createMemo, onCleanup, untrack } from "solid-js";
import { requestAede } from "../platform/desktop";
import type { AccountSession } from "./server";
import type { SourceId } from "./sources";
import type { Job } from "./jobs";
/** Short, owner-scoped leases protect WebKit/external audio while a native feature task is active.
 * Each source/login has its own renewal worker and lease key, with one request in flight.
 * A retired request may finish, but never delays its successor or changes its lease.
 */
export function createBackgroundPriority(input: {
  jobs: () => readonly Job[];
  sessions: Record<SourceId, () => AccountSession | undefined>;
  playing: () => boolean;
}) {
  for (const source of ["local", "server"] as const)
    createEffect(() => {
      const account = input.sessions[source]();
      if (!account) return;
      const client = crypto.randomUUID();
      const target = createMemo(
        () =>
          input.playing() &&
          input
            .jobs()
            .some(
              (job) =>
                job.kind === "mood_features" &&
                ["queued", "running"].includes(job.status) &&
                (job.source ?? "server") === source,
            ),
      );
      let timer: ReturnType<typeof setTimeout> | undefined,
        disposed = false,
        running = false,
        sent = false;
      async function update() {
        if (disposed || running) return;
        running = true;
        const active = untrack(target);
        try {
          if (!active && !sent) return;
          try {
            await requestAede(
              "/api/me/v1/background-priority",
              {},
              "POST",
              { client, active },
              source,
              account,
            );
            sent = !disposed && active;
          } catch {
            // Release is best effort; the server expires it in six seconds without an endless queue.
            if (!active) sent = false;
          }
        } finally {
          running = false;
          if (!disposed && (untrack(target) || sent)) timer = setTimeout(() => void update(), 2000);
        }
      }
      createEffect(() => {
        target();
        clearTimeout(timer);
        void update();
      });
      onCleanup(() => {
        disposed = true;
        clearTimeout(timer);
        // Never send cleanup through a replacement login. Accepted old leases expire server-side.
      });
    });
}

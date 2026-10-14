import { createEffect, onCleanup, untrack } from "solid-js";
import { requestAede } from "../platform/desktop";
import type { AccountSession } from "./server";
import type { SourceId } from "./sources";
import type { Job } from "./jobs";
/** Short, owner-scoped leases protect WebKit/external audio while a native feature task is active.
 * A failed heartbeat never interrupts audio. Server leases expire in six seconds after disconnection.
 */
export function createBackgroundPriority(input: {
  jobs: () => readonly Job[];
  session: (source: SourceId) => AccountSession | undefined;
  playing: () => boolean;
}) {
  const client = crypto.randomUUID();
  const sent = new Map<SourceId, AccountSession>();
  let timer: ReturnType<typeof setTimeout> | undefined,
    disposed = false,
    running = false;
  function targets() {
    return new Map(
      input.playing()
        ? input
            .jobs()
            .filter(
              (job) => job.kind === "mood_features" && ["queued", "running"].includes(job.status),
            )
            .flatMap((job) => {
              const source = job.source ?? "server",
                owner = input.session(source);
              return owner ? [[source, owner] as const] : [];
            })
        : [],
    );
  }
  async function update() {
    if (disposed || running) return;
    running = true;
    try {
      const wanted = untrack(targets);
      for (const source of new Set([...sent.keys(), ...wanted.keys()])) {
        const owner = wanted.get(source),
          previous = sent.get(source);
        if (!owner && previous !== input.session(source)) {
          sent.delete(source);
          continue;
        }
        try {
          await requestAede(
            "/api/me/v1/background-priority",
            {},
            "POST",
            { client, active: !!owner },
            source,
          );
          if (owner && owner === input.session(source)) sent.set(source, owner);
          else sent.delete(source);
        } catch {
          // Bounded leases expire; network trouble must never take down radio/podcast playback.
        }
      }
    } finally {
      running = false;
      if (!disposed && (untrack(targets).size || sent.size))
        timer = setTimeout(() => void update(), 2000);
    }
  }
  createEffect(() => {
    targets();
    if (timer !== undefined) {
      clearTimeout(timer);
      timer = undefined;
    }
    void update();
  });
  onCleanup(() => {
    disposed = true;
    if (timer !== undefined) clearTimeout(timer);
    // Any in-flight lease expires automatically, including after account changes or process exit.
  });
}

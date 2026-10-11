import { createMemo, createResource, createSignal, onCleanup } from "solid-js";
import { t } from "../i18n";
import { requestAede } from "../platform/desktop";
import { referenceSource } from "./sources";
import { parseLyrics } from "./lyrics";
import { acquireQueueLyrics, queueHasLyrics } from "./queue-lyrics";
import type { AccountSession } from "./server";
import type { createJobs } from "./jobs";
/** The library owns downloads; closing a drawer never cancels the captured authenticated batch.
 * Retained availability and title-bearing feedback are visible only to their captured owners.
 */
export function createQueueLyrics(library: {
  queue: () => readonly { reference: string; title: string }[];
  sessionFor: (reference: string) => AccountSession | undefined;
  tasks: Pick<ReturnType<typeof createJobs>, "start" | "jobs">;
}) {
  const [busy, setBusy] = createSignal(false),
    [message, setMessage] = createSignal(""),
    [failed, setFailed] = createSignal(false),
    [feedbackOwners, setFeedbackOwners] =
      createSignal<ReadonlyMap<string, AccountSession | undefined>>();
  let disposed = false,
    cancelled = false;
  onCleanup(() => {
    disposed = true;
    cancelled = true;
  });
  const eligible = () =>
    library.queue().length > 0 &&
    library.queue().every((r) => {
      const s = library.sessionFor(r.reference);
      return s?.account.role === "admin" && s.server.startsWith("http://");
    });
  const identity = createMemo(
    () => {
      const references = [...new Set(library.queue().map((r) => r.reference))].sort();
      return {
        references,
        owners: references.map((r) => library.sessionFor(r)),
        revision: library.tasks
          .jobs()
          .filter(
            (job) =>
              job.kind === "lyrics" &&
              job.status === "completed" &&
              references.includes(job.release ?? ""),
          )
          .map((job) => `${job.source}:${job.task_id}`)
          .sort()
          .join(","),
      };
    },
    undefined,
    {
      equals: (a, b) =>
        a?.revision === b.revision &&
        a.references.join("\n") === b.references.join("\n") &&
        a.owners.every((owner, index) => owner === b.owners[index]),
    },
  );
  const [retainedState, { refetch }] = createResource(
    () => (identity().references.length && identity().owners.every(Boolean) ? identity() : false),
    async (held) => {
      const current = () => !disposed && identity() === held;
      try {
        const complete = await queueHasLyrics(
          held.references,
          current,
          async (reference) =>
            !!parseLyrics(
              await requestAede(
                "/api/v1/lyrics",
                { track: reference },
                "GET",
                null,
                referenceSource(reference),
              ),
              reference,
            )?.lines.some((line) => line.text.trim()),
        );
        return { held, complete, error: "" };
      } catch (error) {
        return { held, complete: false, error: String(error) };
      }
    },
  );
  // A disabled Solid resource retains its last answer; expose only its exact current owners.
  const retained = () => {
    const held = identity(),
      value = retainedState();
    return !disposed && held.owners.every(Boolean) && value?.held === held ? value : undefined;
  };
  const feedbackCurrent = () => {
    const owners = feedbackOwners();
    return (
      !disposed &&
      !!owners &&
      [...owners].every(
        ([reference, owner]) => owner !== undefined && owner === library.sessionFor(reference),
      )
    );
  };
  async function acquire() {
    if (busy() || !eligible()) return;
    setBusy(true);
    setFailed(false);
    setMessage("");
    cancelled = false;
    const titles = new Map(library.queue().map((row) => [row.reference, row.title]));
    const references = library.queue().map((r) => r.reference),
      owners = new Map(references.map((r) => [r, library.sessionFor(r)]));
    setFeedbackOwners(owners);
    const current = () =>
      !disposed && !cancelled && references.every((r) => owners.get(r) === library.sessionFor(r));
    try {
      for (const source of new Set(references.map(referenceSource))) {
        const info = await requestAede<{ capabilities: string[] }>(
          "/api/v1/status",
          {},
          "GET",
          null,
          source,
        );
        if (!info.capabilities.includes("fetch_track_lyrics"))
          throw new Error(t("Mettez à jour puis redémarrez Aède pour télécharger les paroles."));
      }
      const failures: string[] = [];
      const result = await acquireQueueLyrics(references, {
        current,
        available: async (reference) => {
          const raw = await requestAede(
            "/api/v1/lyrics",
            { track: reference },
            "GET",
            null,
            referenceSource(reference),
          );
          return !!parseLyrics(raw, reference)?.lines.some((r) => r.text.trim());
        },
        acquire: async (reference) => {
          if (!current()) return;
          const id = await library.tasks.start("lyrics", reference, false);
          const deadline = Date.now() + 300000;
          while (current()) {
            const job = library.tasks
              .jobs()
              .find((r) => r.task_id === id && r.source === referenceSource(reference));
            if (job?.status === "completed" && (!job.result || job.result.exit_code === 0)) return;
            if (
              job?.tracking_error ||
              ["failed", "cancelled"].includes(job?.status ?? "") ||
              (job?.status === "completed" && job.result?.exit_code !== 0) ||
              Date.now() > deadline
            )
              throw new Error(
                job?.tracking_error ||
                  job?.error?.message ||
                  job?.result?.stderr.trim().slice(0, 800) ||
                  t("Téléchargement des paroles interrompu."),
              );
            await new Promise<void>((resolve) => setTimeout(resolve, 300));
          }
        },
        failure: (reference, reason) => {
          if (failures.length < 3)
            failures.push(`${titles.get(reference) ?? reference} : ${reason.slice(0, 800)}`);
        },
        progress: (value) => {
          if (current())
            setMessage(
              [
                t("Paroles · {0}/{1} · {2} indisponibles", value.done, value.total, value.failed),
                ...failures,
              ].join("\n"),
            );
        },
      });
      if (current()) {
        setFailed(result.failed > 0);
        void refetch();
      }
    } catch (error) {
      if (current()) {
        setFailed(true);
        setMessage(String(error));
      }
    } finally {
      if (!disposed) setBusy(false);
    }
  }
  return {
    busy,
    message: () => (feedbackCurrent() ? message() : ""),
    failed: () => feedbackCurrent() && failed(),
    eligible,
    retained,
    retainedLoading: () => !disposed && identity().owners.every(Boolean) && retainedState.loading,
    acquire,
    cancel: () => {
      cancelled = true;
    },
    clear: () => setMessage(""),
  };
}

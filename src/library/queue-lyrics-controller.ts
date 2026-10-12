import { createSignal, onCleanup } from "solid-js";
import { t } from "../i18n";
import { requestAede } from "../platform/desktop";
import { referenceSource } from "./sources";
import { createQueueLyricAvailability } from "./queue-lyrics-availability";
import { acquireQueueLyrics } from "./queue-lyrics";
import type { AccountSession } from "./server";
import type { createJobs } from "./jobs";
/** The library owns downloads; closing a drawer never cancels the captured authenticated batch.
 * Retained availability and title-bearing feedback are visible only to their captured owners.
 */
export function createQueueLyrics(library: {
  queue: () => readonly { reference: string; title: string }[];
  sessionFor: (reference: string) => AccountSession | undefined;
  tasks: Pick<ReturnType<typeof createJobs>, "start" | "jobs"> &
    Partial<Pick<ReturnType<typeof createJobs>, "cancel">>;
}) {
  const [busy, setBusy] = createSignal(false),
    [message, setMessage] = createSignal(""),
    [failed, setFailed] = createSignal(false),
    [feedbackOwners, setFeedbackOwners] =
      createSignal<ReadonlyMap<string, AccountSession | undefined>>();
  let disposed = false,
    cancelled = false,
    activeTask: { id: number; reference: string; owner: AccountSession | undefined } | undefined;
  onCleanup(() => {
    disposed = true;
    cancelled = true;
  });
  const eligible = (reference?: string) =>
    library.queue().length > 0 &&
    (reference === undefined || library.queue().some((row) => row.reference === reference)) &&
    library
      .queue()
      .filter((row) => reference === undefined || row.reference === reference)
      .every((r) => {
        const s = library.sessionFor(r.reference);
        return s?.account.role === "admin" && s.server.startsWith("http://");
      });
  const availability = createQueueLyricAvailability({ ...library, jobs: library.tasks.jobs });
  const [acquiring, setAcquiring] = createSignal("");
  const [individual, setIndividual] = createSignal<string>();
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
  async function acquire(reference?: string) {
    if (busy() || !eligible(reference)) return;
    setIndividual(reference);
    setBusy(true);
    setFailed(false);
    setMessage("");
    cancelled = false;
    const titles = new Map(library.queue().map((row) => [row.reference, row.title]));
    const references = library
        .queue()
        .filter((row) => reference === undefined || row.reference === reference)
        .map((r) => r.reference),
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
        available: (reference) => availability.read(reference, owners.get(reference)),
        acquire: async (reference) => {
          if (!current()) return;
          setAcquiring(reference);
          const id = await library.tasks.start("lyrics", reference, false);
          activeTask = { id, reference, owner: owners.get(reference) };
          if (!current()) {
            if (cancelled && !disposed) await cancel();
            return;
          }
          const deadline = Date.now() + 300000;
          while (current()) {
            const job = library.tasks
              .jobs()
              .find((r) => r.task_id === id && r.source === referenceSource(reference));
            if (job?.status === "completed" && (!job.result || job.result.exit_code === 0)) {
              activeTask = undefined;
              await availability.read(reference, owners.get(reference));
              return;
            }
            if (
              job?.tracking_error ||
              ["failed", "cancelled"].includes(job?.status ?? "") ||
              (job?.status === "completed" && job.result?.exit_code !== 0) ||
              Date.now() > deadline
            ) {
              activeTask = undefined;
              throw new Error(
                job?.tracking_error ||
                  job?.error?.message ||
                  job?.result?.stderr.trim().slice(0, 800) ||
                  t("Téléchargement des paroles interrompu."),
              );
            }
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
        availability.refresh();
      }
    } catch (error) {
      if (current()) {
        setFailed(true);
        setMessage(String(error));
      }
    } finally {
      if (!disposed) {
        setBusy(false);
        setAcquiring("");
        activeTask = undefined;
      }
    }
  }
  async function cancel() {
    cancelled = true;
    const task = activeTask;
    activeTask = undefined;
    if (!task || disposed || !task.owner || task.owner !== library.sessionFor(task.reference))
      return;
    try {
      await library.tasks.cancel?.(task.id, referenceSource(task.reference));
    } catch (failure) {
      if (feedbackCurrent()) {
        setFailed(true);
        setMessage(String(failure));
      }
    }
  }
  return {
    busy,
    bulkOperation: () => feedbackCurrent() && individual() === undefined,
    bulkBusy: () => feedbackCurrent() && busy() && individual() === undefined,
    trackBusy: (reference: string) =>
      feedbackCurrent() &&
      busy() &&
      (individual() === reference || (individual() === undefined && acquiring() === reference)),
    message: () => (feedbackCurrent() ? message() : ""),
    failed: () => feedbackCurrent() && failed(),
    eligible,
    available: availability.available,
    acquiring: () => (feedbackCurrent() ? acquiring() : ""),
    retained: availability.retained,
    retainedLoading: availability.loading,
    acquire,
    cancel,
    clear: () => setMessage(""),
  };
}

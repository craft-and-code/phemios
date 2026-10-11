import { Portal } from "solid-js/web";
import { createMemo, createResource, createSignal, onCleanup, Show } from "solid-js";
import { t } from "../i18n";
import { useLibrary } from "../library/context";
import { requestAede } from "../platform/desktop";
import { referenceSource } from "../library/sources";
import { parseLyrics } from "../library/lyrics";
import { acquireQueueLyrics, queueHasLyrics } from "../library/queue-lyrics";
import { Icon } from "./Icon";
import { Feedback } from "./Feedback";
/** Explicit sequential acquisition preserves existing lyrics and source-bound account authority. */
export function QueueLyrics(props: { feedbackHost: () => HTMLElement | undefined }) {
  const library = useLibrary(),
    [busy, setBusy] = createSignal(false),
    [message, setMessage] = createSignal(""),
    [failed, setFailed] = createSignal(false);
  let disposed = false,
    cancelled = false;
  onCleanup(() => {
    disposed = true;
    cancelled = true;
  });
  const eligible = () =>
    library.player.queue().length > 0 &&
    library.player.queue().every((r) => {
      const s = library.sessionFor(r.reference);
      return s?.account.role === "admin" && s.server.startsWith("http://");
    });
  const identity = createMemo(
    () => {
      const references = [...new Set(library.player.queue().map((r) => r.reference))].sort();
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
  const [retained, { refetch }] = createResource(
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
        return { complete, error: "" };
      } catch (error) {
        return { complete: false, error: String(error) };
      }
    },
  );
  async function acquire() {
    setBusy(true);
    setFailed(false);
    setMessage("");
    cancelled = false;
    const references = library.player.queue().map((r) => r.reference),
      owners = new Map(references.map((r) => [r, library.sessionFor(r)]));
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
            await new Promise<void>((resolve) => window.setTimeout(resolve, 300));
          }
        },
        failure: (reference, reason) => {
          if (failures.length < 3)
            failures.push(
              `${library.player.queue().find((row) => row.reference === reference)?.title ?? reference} : ${reason.slice(0, 800)}`,
            );
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
  return (
    <span class="queue-lyrics">
      <button
        class="icon-button quiet"
        aria-label={
          busy()
            ? t("Arrêter le téléchargement des paroles")
            : t("Télécharger les paroles de la liste")
        }
        title={
          busy()
            ? t("Arrêter le téléchargement des paroles")
            : t("Télécharger les paroles de la liste")
        }
        disabled={!busy() && (!eligible() || retained.loading || retained()?.complete === true)}
        onClick={() => {
          if (busy()) cancelled = true;
          else void acquire();
        }}
      >
        <Show when={busy()} fallback={<Icon name="lyrics-download" />}>
          <span class="spinner" />
        </Show>
      </button>
      <Show when={props.feedbackHost()}>
        {(host) => (
          <Portal mount={host()}>
            <Feedback
              class="queue-lyrics-result"
              message={message() || retained()?.error || ""}
              error={failed() || !!retained()?.error}
              onClose={() => setMessage("")}
            />
          </Portal>
        )}
      </Show>
    </span>
  );
}

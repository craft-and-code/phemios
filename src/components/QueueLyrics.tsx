import { createSignal, onCleanup, Show } from "solid-js";
import { t } from "../i18n";
import { useLibrary } from "../library/context";
import { requestAede } from "../platform/desktop";
import { referenceSource } from "../library/sources";
import { parseLyrics } from "../library/lyrics";
import { acquireQueueLyrics } from "../library/queue-lyrics";
import { Icon } from "./Icon";
import { Feedback } from "./Feedback";
/** Explicit sequential acquisition preserves existing lyrics and source-bound account authority. */
export function QueueLyrics() {
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
            if (job?.status === "completed") return;
            if (
              job?.tracking_error ||
              ["failed", "cancelled"].includes(job?.status ?? "") ||
              Date.now() > deadline
            )
              throw new Error("Lyrics task did not complete");
            await new Promise<void>((resolve) => window.setTimeout(resolve, 300));
          }
        },
        progress: (value) => {
          if (current())
            setMessage(
              t("Paroles · {0}/{1} · {2} indisponibles", value.done, value.total, value.failed),
            );
        },
      });
      if (current()) setFailed(result.failed > 0);
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
        disabled={!busy() && !eligible()}
        onClick={() => {
          if (busy()) cancelled = true;
          else void acquire();
        }}
      >
        <Show when={busy()} fallback={<Icon name="lyrics-download" />}>
          <span class="spinner" />
        </Show>
      </button>
      <Feedback
        class="queue-lyrics-result"
        message={message()}
        error={failed()}
        onClose={() => setMessage("")}
      />
    </span>
  );
}

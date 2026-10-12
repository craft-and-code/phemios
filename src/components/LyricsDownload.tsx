import { Feedback } from "./Feedback";
import { createMemo, createSignal, Show } from "solid-js";
import { t } from "../i18n";
import { requestAede } from "../platform/desktop";
import { useLibrary } from "../library/context";
import { referenceSource } from "../library/sources";
import { DownloadButton } from "./DownloadButton";
/** Explicit LRCLIB acquisition delegates exact-track scope and sidecar preservation to Aède.
 * The download check follows confirmed completion, and replaced owners cannot inherit old jobs.
 */
export function LyricsDownload(props: { reference: string }) {
  const library = useLibrary();
  const identity = createMemo(
    () => ({ reference: props.reference, session: library.sessionFor(props.reference) }),
    undefined,
    { equals: (a, b) => a.reference === b.reference && a.session === b.session },
  );
  type Identity = ReturnType<typeof identity>;
  const [submitting, setSubmitting] = createSignal<Identity>(),
    [submitted, setSubmitted] = createSignal<{ held: Identity; id: number }>(),
    [cancelled, setCancelled] = createSignal<Identity>(),
    [error, setError] = createSignal<{ held: Identity; message: string }>();
  const job = () => {
    const held = submitted();
    return held?.held === identity()
      ? library.tasks
          .jobs()
          .find(
            (row) =>
              row.task_id === held.id &&
              row.kind === "lyrics" &&
              row.release === held.held.reference &&
              row.source === referenceSource(held.held.reference),
          )
      : undefined;
  };
  const active = () =>
    submitting() === identity() || ["queued", "running"].includes(job()?.status ?? "");
  async function fetchWords() {
    const held = identity();
    setSubmitting(held);
    setCancelled(undefined);
    setError(undefined);
    try {
      const info = await requestAede<{ capabilities?: string[] }>(
        "/api/v1/status",
        {},
        "GET",
        null,
        referenceSource(held.reference),
      );
      if (!info.capabilities?.includes("fetch_track_lyrics"))
        throw new Error(t("Mettez à jour puis redémarrez Aède pour télécharger les paroles."));
      if (!held.session || held !== identity()) throw new Error(t("Session invalide."));
      if (cancelled() === held) return;
      const id = await library.tasks.start("lyrics", held.reference, false);
      if (held === identity()) {
        setSubmitted({ held, id });
        if (cancelled() === held) await library.tasks.cancel(id, referenceSource(held.reference));
      }
    } catch (failure) {
      if (held === identity()) setError({ held, message: String(failure) });
    } finally {
      if (submitting() === held) setSubmitting(undefined);
    }
  }
  const failure = () => (error()?.held === identity() ? (error()?.message ?? "") : "");
  const taskFailure = () =>
    job()?.tracking_error ||
    (job() &&
    !active() &&
    (job()?.status !== "completed" || (job()?.result && job()?.result?.exit_code !== 0))
      ? job()?.error?.message ||
        job()?.result?.stderr.trim().slice(0, 800) ||
        t("Téléchargement impossible.")
      : "");
  return (
    <span class="lyrics-action">
      <DownloadButton
        label={t("Télécharger les paroles · LRCLIB, sans clé API")}
        icon="lyrics-download"
        identity={identity()}
        disabled={
          identity().session?.account.role !== "admin" ||
          !identity().session?.server.startsWith("http://")
        }
        busy={active()}
        completed={
          job()?.status === "completed" && (!job()?.result || job()?.result?.exit_code === 0)
        }
        confirmOnResolve={false}
        cancelLabel={t("Arrêter le téléchargement des paroles")}
        onCancel={() => {
          const held = identity(),
            current = job();
          if (
            cancelled() === held ||
            !held.session ||
            held.session !== library.sessionFor(held.reference)
          )
            return;
          setCancelled(held);
          if (current)
            void library.tasks
              .cancel(current.task_id, referenceSource(held.reference))
              .catch((failure) => {
                if (held === identity()) {
                  setCancelled(undefined);
                  setError({ held, message: String(failure) });
                }
              });
        }}
        onClick={fetchWords}
      />
      <Show when={failure() || taskFailure()}>
        <Feedback
          class="lyrics-action-result"
          error
          message={failure() || taskFailure()}
          onClose={() => {
            setError(undefined);
            setSubmitted(undefined);
          }}
        />
      </Show>
    </span>
  );
}

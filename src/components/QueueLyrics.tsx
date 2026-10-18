import type { createQueueLyrics } from "../library/queue-lyrics-controller";
import { ActivityGlyph } from "./ActivityGlyph";
import { Portal } from "solid-js/web";
import { createEffect, createMemo, on, Show } from "solid-js";
import { createDownloadFeedback } from "../library/download-feedback";
import { t } from "../i18n";
import { useLibrary } from "../library/context";
import { Icon } from "./Icon";
import { Feedback } from "./Feedback";
/** This drawer displays the shared download operation without owning its lifetime. */
export function QueueLyrics(props: {
  feedbackHost: () => HTMLElement | undefined;
  controller?: ReturnType<typeof createQueueLyrics>;
  tracks?: readonly { reference: string }[];
  label?: string;
}) {
  const library = useLibrary(),
    job = props.controller ?? library.queueLyrics;
  const feedback = createDownloadFeedback();
  const identity = createMemo(
    () =>
      (props.tracks ?? library.player.queue()).map((row) => ({
        reference: row.reference,
        owner: library.sessionFor(row.reference),
      })),
    undefined,
    {
      equals: (a, b) =>
        a.length === b.length &&
        a.every(
          (row, index) => row.reference === b[index]?.reference && row.owner === b[index]?.owner,
        ),
    },
  );
  createEffect(on(identity, () => feedback.reset()));
  createEffect(
    on(
      () =>
        job.bulkOperation() &&
        !job.busy() &&
        !job.failed() &&
        !!job.message() &&
        job.retained()?.complete === true,
      (complete, previous) => {
        if (complete && !previous) feedback.complete();
      },
    ),
  );
  return (
    <span class="queue-lyrics">
      <button
        class="icon-button quiet"
        classList={{ "download-complete": feedback.phase() === "complete" }}
        aria-label={
          job.bulkBusy()
            ? t("Arrêter le téléchargement des paroles")
            : (props.label ?? t("Télécharger les paroles de la liste"))
        }
        title={
          job.bulkBusy()
            ? t("Arrêter le téléchargement des paroles")
            : (props.label ?? t("Télécharger les paroles de la liste"))
        }
        disabled={
          (job.busy() && !job.bulkBusy()) ||
          (!job.bulkBusy() &&
            (!job.eligible() || job.retainedLoading() || job.retained()?.complete === true))
        }
        onClick={() => {
          if (job.bulkBusy()) void job.cancel();
          else void job.acquire();
        }}
      >
        <Show
          when={job.bulkBusy()}
          fallback={<Icon name={feedback.phase() === "complete" ? "check" : "lyrics-download"} />}
        >
          <ActivityGlyph cancellable />
        </Show>
      </button>
      <Show when={props.feedbackHost()}>
        {(host) => (
          <Portal mount={host()}>
            <Feedback
              class="queue-lyrics-result"
              message={(job.failed() ? job.message() : "") || job.retained()?.error || ""}
              error={job.failed() || !!job.retained()?.error}
              onClose={job.clear}
            />
          </Portal>
        )}
      </Show>
    </span>
  );
}

import { Portal } from "solid-js/web";
import { Show } from "solid-js";
import { t } from "../i18n";
import { useLibrary } from "../library/context";
import { Icon } from "./Icon";
import { Feedback } from "./Feedback";
/** This drawer displays the shared download operation without owning its lifetime. */
export function QueueLyrics(props: { feedbackHost: () => HTMLElement | undefined }) {
  const job = useLibrary().queueLyrics;
  return (
    <span class="queue-lyrics">
      <button
        class="icon-button quiet"
        aria-label={
          job.busy()
            ? t("Arrêter le téléchargement des paroles")
            : t("Télécharger les paroles de la liste")
        }
        title={
          job.busy()
            ? t("Arrêter le téléchargement des paroles")
            : t("Télécharger les paroles de la liste")
        }
        disabled={
          !job.busy() &&
          (!job.eligible() || job.retained.loading || job.retained()?.complete === true)
        }
        onClick={() => {
          if (job.busy()) job.cancel();
          else void job.acquire();
        }}
      >
        <Show when={job.busy()} fallback={<Icon name="lyrics-download" />}>
          <span class="spinner" />
        </Show>
      </button>
      <Show when={props.feedbackHost()}>
        {(host) => (
          <Portal mount={host()}>
            <Feedback
              class="queue-lyrics-result"
              message={job.message() || job.retained()?.error || ""}
              error={job.failed() || !!job.retained()?.error}
              onClose={job.clear}
            />
          </Portal>
        )}
      </Show>
    </span>
  );
}

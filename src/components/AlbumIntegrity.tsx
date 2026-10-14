import { createSignal, Show } from "solid-js";
import { useLibrary } from "../library/context";
import { Icon } from "./Icon";
import { ActionButton } from "./ActionButton";
import { Feedback } from "./Feedback";
import { t } from "../i18n";
/** Fresh complete decoding runs on the source engine, without playing or rewriting audio. */
export function AlbumIntegrity(props: { release: string }) {
  const library = useLibrary(),
    [pending, setPending] = createSignal(false),
    [error, setError] = createSignal("");
  const job = () =>
    library.tasks
      .jobs()
      .slice()
      .reverse()
      .find((row) => row.release === props.release && row.kind === "check");
  const active = () => pending() || (!!job() && ["queued", "running"].includes(job()!.status));
  async function start() {
    setPending(true);
    setError("");
    try {
      await library.tasks.start("check", props.release, true);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure));
    } finally {
      setPending(false);
    }
  }
  return (
    <div class="album-integrity">
      <ActionButton
        icon="check"
        busy={active()}
        disabled={active() || library.sessionFor(props.release)?.account.role !== "admin"}
        onClick={() => void start()}
      >
        {t("Tester l’intégrité de l’album")}
      </ActionButton>
      <Show when={active() && job()}>
        <button
          class="icon-button"
          aria-label={t("Arrêter le test")}
          title={t("Arrêter le test")}
          onClick={() =>
            void library.tasks
              .cancel(job()!.task_id, job()!.source)
              .catch((failure) => setError(String(failure)))
          }
        >
          <Icon name="stop" />
        </button>
      </Show>
      <Feedback
        error
        persistent
        message={error() || job()?.tracking_error || job()?.error?.message || ""}
      />
      <Show when={job()?.result}>
        <details class="job-result">
          <summary>
            {job()?.status === "failed"
              ? t("Test d’intégrité échoué")
              : job()?.status === "cancelled"
                ? t("Test d’intégrité annulé")
                : t("Résultat du test d’intégrité")}
          </summary>
          <pre>
            {job()?.result?.stdout}
            {job()?.result?.stderr}
          </pre>
        </details>
      </Show>
    </div>
  );
}

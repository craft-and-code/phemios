import { activeReleaseJob } from "../library/jobs";
import { t } from "../i18n";
import { createSignal, For, Show } from "solid-js";
import { useLibrary } from "../library/context";
/** Explicit launch, force option and cancellable server status. */
export function JobControls(props: {
  release: string;
  coverage?: { tracks: number; current: number; spectra: number };
}) {
  const library = useLibrary(),
    [force, setForce] = createSignal(false),
    [busy, setBusy] = createSignal(false),
    [error, setError] = createSignal("");
  const active = () => activeReleaseJob(library.tasks.jobs(), props.release);
  async function start(kind: "analyze" | "spectrum") {
    setBusy(true);
    setError("");
    try {
      await library.tasks.start(kind, props.release, force());
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : t("Lancement impossible."));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section class="job-controls" aria-busy={busy() || !!active()}>
      <div class="job-actions">
        <button
          disabled={
            !library.sessionFor(props.release) ||
            library.sessionFor(props.release)?.account.role !== "admin" ||
            busy() ||
            !!active() ||
            (!force() &&
              props.coverage !== undefined &&
              props.coverage.current === props.coverage.tracks)
          }
          onClick={() => start("analyze")}
        >
          {t("Analyser avec FlacCompagnon")}{" "}
        </button>
        <button
          disabled={
            !library.sessionFor(props.release) ||
            library.sessionFor(props.release)?.account.role !== "admin" ||
            busy() ||
            !!active() ||
            (!force() &&
              props.coverage !== undefined &&
              props.coverage.spectra === props.coverage.tracks)
          }
          onClick={() => start("spectrum")}
        >
          {t("Générer les spectres")}{" "}
        </button>
      </div>
      <Show when={busy() || active()}>
        <p class="job-activity" role="status">
          <span class="spinner" aria-hidden="true" />
          {busy()
            ? t("Démarrage du traitement…")
            : active()?.status === "queued"
              ? t("Traitement en attente…")
              : t("Traitement en cours…")}
        </p>
      </Show>
      <label class="job-force">
        <input
          type="checkbox"
          checked={force()}
          onChange={(event) => setForce(event.currentTarget.checked)}
        />{" "}
        {t("Recalculer les résultats existants")}{" "}
      </label>
      <small>
        {t(
          "Ces travaux s’exécutent sur Aède. Un compte administrateur et le serveur local sont requis.",
        )}{" "}
      </small>
      <Show when={error() || library.tasks.error()}>
        <p role="alert">{error() || library.tasks.error()}</p>
      </Show>
      <div aria-live="polite">
        <For each={library.tasks.jobs().filter((job) => job.release === props.release)}>
          {(job) => (
            <div class="job-result">
              <span>
                {t("Tâche")} {job.task_id} · {job.task_kind ?? job.kind ?? "traitement"} ·{" "}
                {
                  {
                    queued: t("En attente"),
                    running: t("En cours"),
                    completed: t("Terminée"),
                    failed: t("Échec"),
                    cancelled: t("Annulée"),
                  }[job.status]
                }
              </span>
              <Show when={job.status === "queued" || job.status === "running"}>
                <button
                  onClick={() =>
                    library.tasks
                      .cancel(job.task_id, job.source)
                      .catch((failure) => setError(String(failure)))
                  }
                >
                  {t("Annuler")}{" "}
                </button>
              </Show>
              <Show when={job.result || job.error}>
                <details>
                  <summary>{t("Résultat du serveur")}</summary>
                  <pre>
                    {job.result ? `${job.result.stdout}\n${job.result.stderr}` : job.error?.message}
                  </pre>
                  <Show when={job.result?.output_truncated}>
                    <small>{t("Le journal a été raccourci par Aède.")}</small>
                  </Show>
                </details>
              </Show>
            </div>
          )}
        </For>
      </div>
    </section>
  );
}

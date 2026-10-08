import { createSignal, For, Show } from "solid-js";
import { useLibrary } from "../library/context";
/** Explicit launch, force option and cancellable server status. */
export function JobControls(props: { release: string }) {
  const library = useLibrary(),
    [force, setForce] = createSignal(false),
    [busy, setBusy] = createSignal(false),
    [error, setError] = createSignal("");
  async function start(kind: "analyze" | "spectrum") {
    setBusy(true);
    setError("");
    try {
      await library.tasks.start(kind, props.release, force());
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Lancement impossible.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section class="job-controls">
      <div class="job-actions">
        <button
          disabled={!library.session() || library.session()?.account.role !== "admin" || busy()}
          onClick={() => start("analyze")}
        >
          Analyser avec FlacCompagnon
        </button>
        <button
          disabled={!library.session() || library.session()?.account.role !== "admin" || busy()}
          onClick={() => start("spectrum")}
        >
          Générer les spectres
        </button>
        <label>
          <input
            type="checkbox"
            checked={force()}
            onChange={(event) => setForce(event.currentTarget.checked)}
          />{" "}
          Recalculer les résultats existants
        </label>
      </div>
      <small>
        Ces travaux s’exécutent sur Aède. Un compte administrateur et le serveur local sont requis.
      </small>
      <Show when={error() || library.tasks.error()}>
        <p role="alert">{error() || library.tasks.error()}</p>
      </Show>
      <div aria-live="polite">
        <For each={library.tasks.jobs().filter((job) => job.release === props.release)}>
          {(job) => (
            <div class="job-result">
              <span>
                Tâche {job.task_id} · {job.task_kind ?? job.kind ?? "traitement"} ·{" "}
                {
                  {
                    queued: "En attente",
                    running: "En cours",
                    completed: "Terminée",
                    failed: "Échec",
                    cancelled: "Annulée",
                  }[job.status]
                }
              </span>
              <Show when={job.status === "queued" || job.status === "running"}>
                <button
                  onClick={() =>
                    library.tasks.cancel(job.task_id).catch((failure) => setError(String(failure)))
                  }
                >
                  Annuler
                </button>
              </Show>
              <Show when={job.result || job.error}>
                <details>
                  <summary>Résultat du serveur</summary>
                  <pre>
                    {job.result ? `${job.result.stdout}\n${job.result.stderr}` : job.error?.message}
                  </pre>
                  <Show when={job.result?.output_truncated}>
                    <small>Le journal a été raccourci par Aède.</small>
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

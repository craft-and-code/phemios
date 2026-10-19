import { createGenerationActions } from "../library/generation-actions";
import { createMemo, createSignal, For, Show } from "solid-js";
import { createDiagnosticRead } from "../library/diagnostic-read";
import { requestAede } from "../platform/desktop";
import { t } from "../i18n";
import { useLibrary } from "../library/context";
import { LibraryGenerations } from "../components/LibraryGenerations";
import { Feedback } from "../components/Feedback";
import { RefreshButton } from "../components/RefreshButton";
import { sourceLabel, type SourceId } from "../library/sources";
import { administrativeWorkActive, generationForJob } from "../library/generation-policy";
/** Every accepted plan lives on Aède; leaving Settings never cancels it or starts another stage client-side. */
export function SettingsAede() {
  const library = useLibrary(),
    [selected, setSelected] = createSignal<SourceId>(library.source());
  const sources = createMemo(() =>
    (["local", "server"] as const).filter(
      (source) => !!(source === "local" ? library.localSession() : library.serverSession()),
    ),
  );
  const source = () => (sources().length === 1 ? sources()[0]! : selected());
  const account = () => (source() === "local" ? library.localSession() : library.serverSession());
  const capabilities = createDiagnosticRead(
    () => (account()?.account.role === "admin" ? { source: source(), owner: account()! } : false),
    async (key) => {
      const info = await requestAede<{ capabilities?: string[] }>(
        "/api/v1/status",
        {},
        "GET",
        null,
        key.source,
        key.owner,
      );
      if (!Array.isArray(info.capabilities) || !info.capabilities.includes("library_generations"))
        throw new Error(
          t("Mettez à jour puis redémarrez Aède pour les générations de bibliothèque."),
        );
      return info.capabilities;
    },
  );
  const active = () =>
    library.tasks
      .jobs()
      .find(
        (job) => ["queued", "running"].includes(job.status) && generationForJob(job) !== undefined,
      );
  const pending = library.tasks.generationPending;
  const action = () =>
    pending()
      ? pending()!.steps.length === 1
        ? pending()!.steps[0]
        : "all"
      : active()
        ? generationForJob(active()!)
        : undefined;
  const { error, start, cancel } = createGenerationActions({
    source,
    session: (origin) => (origin === "local" ? library.localSession() : library.serverSession()),
    active,
    start: library.tasks.generate,
    cancel: library.tasks.cancel,
  });
  return (
    <div class="settings-card">
      <h2>{t("Générations Aède")}</h2>
      <p class="muted">
        {t(
          "Chaque action traite toute la bibliothèque sélectionnée. Tout lancer exécute les quatre étapes dans l’ordre, en arrière-plan. Les fichiers audio et leurs tags restent intacts.",
        )}
      </p>
      <Show when={sources().length > 1}>
        <div class="choices" role="group" aria-label={t("Bibliothèque à traiter")}>
          <For each={sources()}>
            {(item) => (
              <button
                type="button"
                aria-pressed={source() === item}
                disabled={!!pending() || administrativeWorkActive(library.tasks.jobs())}
                onClick={() => setSelected(item)}
              >
                {sourceLabel(item)}
              </button>
            )}
          </For>
        </div>
      </Show>
      <Show when={!account()}>
        <p class="notice">{t("Connectez-vous pour accéder aux données de votre compte.")}</p>
      </Show>
      <Show when={account() && account()?.account.role !== "admin"}>
        <p class="notice">{t("Droits administrateur nécessaires.")}</p>
      </Show>
      <LibraryGenerations
        enabled={account()?.account.role === "admin" && !!capabilities.current()}
        lyricsSupported={!!capabilities.current()?.includes("fetch_track_lyrics")}
        reserved={!!pending() || administrativeWorkActive(library.tasks.jobs())}
        action={action()}
        onStart={(steps) => void start(steps)}
        onCancel={() => void cancel()}
        cancellable={!!active()}
      />
      <Show when={active()}>
        {(job) => (
          <p role="status">
            {sourceLabel(job().source ?? "server")} · {t("Tâche")} #{job().task_id} ·{" "}
            {job().status === "queued" ? t("En attente") : t("En cours")}
          </p>
        )}
      </Show>
      <Show when={active()?.tracking_error}>
        <div class="error-retry">
          <Feedback error persistent message={active()?.tracking_error ?? ""} />
          <RefreshButton
            busy={false}
            onRefresh={() => void library.tasks.restore(active()?.source ?? source())}
          />
        </div>
      </Show>
      <Show when={!active() && !pending() && administrativeWorkActive(library.tasks.jobs())}>
        <p role="status">{t("Un traitement Aède est déjà actif.")}</p>
      </Show>
      <Feedback error message={error() || capabilities.error()} />
      <div class="generation-results">
        <For
          each={library.tasks
            .jobs()
            .filter(
              (job) =>
                generationForJob(job) !== undefined && !["queued", "running"].includes(job.status),
            )
            .slice(-3)}
        >
          {(job) => (
            <details>
              <summary>
                {sourceLabel(job.source ?? "server")} · {t("Tâche")} #{job.task_id} ·{" "}
                {job.status === "completed"
                  ? t("Terminée")
                  : job.status === "cancelled"
                    ? t("Annulée")
                    : t("Échec")}
              </summary>
              <pre>
                {job.result ? `${job.result.stdout}\n${job.result.stderr}` : job.error?.message}
              </pre>
            </details>
          )}
        </For>
      </div>
    </div>
  );
}

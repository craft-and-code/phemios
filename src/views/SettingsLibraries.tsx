import { Feedback } from "../components/Feedback";
import { createToolPreferences } from "../library/tool-preferences";
import { t } from "../i18n";
import { createResource, createSignal, For, Show, onCleanup } from "solid-js";
import { useLibrary } from "../library/context";
import { ConnectionPanel } from "../components/ConnectionPanel";
import {
  localStatus,
  pickLocalRoots,
  scanLocal,
  localRootAction,
  requestAede,
} from "../platform/desktop";
import type { Job } from "../library/jobs";
/** Registered folders, availability and explicit tasks are kept distinct. */
export function SettingsLibraries() {
  const prefs = createToolPreferences();
  const full = () => prefs.value().full,
    threads = () => prefs.value().threads;
  const setFull = (full: boolean) => prefs.update({ full }),
    setThreads = (threads: number) => prefs.update({ threads });
  const library = useLibrary(),
    [error, setError] = createSignal(""),
    [busy, setBusy] = createSignal(false),
    [excluded, setExcluded] = createSignal(""),
    [task, setTask] = createSignal<Job>(),
    [taskSource, setTaskSource] = createSignal<"local" | "server">("local"),
    [remoteFolders, setRemoteFolders] = createSignal("");
  const [local, { refetch }] = createResource(() => !library.demo, localStatus);
  const [roots, { refetch: refreshRoots }] = createResource(
    () => library.localSession(),
    () =>
      requestAede<{ items: { path: string | null; status: string }[] }>(
        "/api/v1/roots",
        { limit: "200" },
        "GET",
        null,
        "local",
      ),
  );
  const administrative = () =>
    library.serverSession()?.account.role === "admin" &&
    library.serverSession()?.server.startsWith("http://");
  async function perform(work: () => Promise<unknown>) {
    if (busy()) return;
    setError("");
    setBusy(true);
    try {
      await work();
      await refetch();
      await refreshRoots();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }
  const timer = window.setInterval(() => {
    if (task() && ["queued", "running"].includes(task()!.status) && !busy()) void refreshTask();
  }, 1200);
  onCleanup(() => window.clearInterval(timer));
  async function refreshTask() {
    const current = task();
    if (!current) return;
    await perform(async () => {
      const result = await requestAede<Job>(
        `/api/admin/v1/tasks/${current.task_id}`,
        {},
        "GET",
        null,
        taskSource(),
      );
      setTask(result);
      if (result.status === "completed") await library.sync(taskSource());
    });
  }
  return (
    <div class="settings-libraries">
      <Show when={prefs.error()}>
        <p role="alert">{prefs.error()}</p>
      </Show>
      <div class="settings-card">
        <h2>{t("Bibliothèque locale")}</h2>
        <p>
          {t(
            "Ajoutez vos dossiers, y compris les partages réseau déjà montés par votre système. Leur contenu rejoint le catalogue commun avec l’origine Local.",
          )}{" "}
        </p>
        <Show when={local.error}>
          <p role="alert">{String(local.error)}</p>
        </Show>
        <div class="settings-actions">
          <button
            class="primary"
            disabled={busy() || library.demo}
            onClick={() => void perform(() => library.enableLocal())}
          >
            {library.localSession() ? t("Reconnecter le moteur local") : t("Activer Aède local")}
          </button>
          <button
            disabled={busy() || !library.localSession()}
            onClick={() => void perform(() => library.disableLocal())}
          >
            {t("Désactiver le moteur local")}{" "}
          </button>
          <button disabled={busy() || library.demo} onClick={() => void perform(pickLocalRoots)}>
            {t("Ajouter des dossiers…")}{" "}
          </button>
        </div>
        <Show when={local()?.enabled && !local()?.running}>
          <p class="notice">
            {t(
              "Le moteur local est arrêté. Reconnectez-le pour lire ou modifier la bibliothèque.",
            )}{" "}
          </p>
        </Show>
        <ul class="root-list">
          <For each={local()?.roots}>
            {(root) => (
              <li>
                <div>
                  <strong>{root.path}</strong>
                  <small>
                    {root.available ? t("Disponible") : t("Indisponible · catalogue conservé")}
                    {root.mount ? ` · ${root.mount}` : ""}
                  </small>
                </div>
                <button
                  disabled={busy()}
                  onClick={() => void perform(() => localRootAction(root.path, "remove"))}
                >
                  {t("Retirer")}{" "}
                </button>
                <button
                  disabled={busy() || !library.localSession()}
                  onClick={() => void perform(() => localRootAction(root.path, "exclude"))}
                >
                  {t("Exclure")}{" "}
                </button>
              </li>
            )}
          </For>
        </ul>
        <p class="muted">
          {t(
            "Ajouter un dossier ne lance aucun scan. Retirer ou exclure un dossier sera appliqué au catalogue lors de l’analyse suivante ; les fichiers audio et les annotations sont conservés.",
          )}{" "}
        </p>
        <div class="settings-actions">
          <button
            disabled={busy() || !library.localSession() || !local()?.roots.length}
            onClick={() =>
              void perform(async () => {
                setTaskSource("local");
                setTask(await scanLocal(full(), threads()));
              })
            }
          >
            {t("Analyser les dossiers")}{" "}
          </button>
          <button
            disabled={busy() || !library.localSession()}
            onClick={() => void perform(() => library.sync("local"))}
          >
            {t("Synchroniser le catalogue local")}{" "}
          </button>
        </div>
        <small class="settings-persistence">
          {t("Les options sont enregistrées automatiquement.")}
        </small>
        <label class="check">
          <input
            type="checkbox"
            checked={full()}
            onChange={(e) => setFull(e.currentTarget.checked)}
          />
          {t("Relire tous les fichiers")}{" "}
        </label>
        <label>
          {t("Threads (0 = automatique)")}{" "}
          <input
            type="number"
            min="0"
            max="64"
            value={threads()}
            onInput={(e) => setThreads(e.currentTarget.valueAsNumber)}
          />
        </label>
        <details>
          <summary>{t("Exclusions")}</summary>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void perform(() => localRootAction(excluded(), "exclude"));
            }}
          >
            <label>
              {t("Dossier à exclure")}{" "}
              <input
                required
                value={excluded()}
                onInput={(e) => setExcluded(e.currentTarget.value)}
              />
            </label>
            <div class="settings-actions">
              <button disabled={busy() || !library.localSession()}>{t("Exclure")}</button>
              <button
                type="button"
                disabled={busy() || !library.localSession()}
                onClick={() => void perform(() => localRootAction(excluded(), "include"))}
              >
                {t("Retirer l’exclusion")}{" "}
              </button>
            </div>
          </form>
          <p class="muted">
            {t(
              "Les exclusions utilisent les règles roots d’Aède. Vous pouvez retirer une exclusion en indiquant son chemin.",
            )}{" "}
          </p>
          <For each={roots()?.items.filter((row) => row.status === "excluded")}>
            {(row) => (
              <div class="account-row">
                <span>{row.path}</span>
                <button
                  disabled={busy() || !row.path}
                  onClick={() => void perform(() => localRootAction(row.path!, "include"))}
                >
                  {t("Retirer l’exclusion")}{" "}
                </button>
              </div>
            )}
          </For>
          <Show when={roots.error}>
            <p role="alert">{String(roots.error)}</p>
          </Show>
        </details>
      </div>
      <div class="settings-card">
        <h2>{t("Serveur Aède")}</h2>
        <ConnectionPanel embedded onClose={() => {}} />
        <Show when={administrative()}>
          <details>
            <summary>{t("Dossiers et scan du serveur")}</summary>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void perform(async () => {
                  setTaskSource("server");
                  setTask(
                    await requestAede<Job>(
                      "/api/admin/v1/scan",
                      {},
                      "POST",
                      {
                        folders: remoteFolders()
                          .split("\n")
                          .map((s) => s.trim())
                          .filter(Boolean),
                        full: full(),
                        threads: threads(),
                      },
                      "server",
                    ),
                  );
                });
              }}
            >
              <label>
                {t("Dossiers sur le serveur (un chemin absolu par ligne)")}{" "}
                <textarea
                  value={remoteFolders()}
                  onInput={(e) => setRemoteFolders(e.currentTarget.value)}
                />
              </label>
              <button disabled={busy()}>{t("Lancer le scan du serveur")}</button>
            </form>
            <p class="muted">
              {t(
                "Sans dossier indiqué, Aède analyse ses racines existantes. Le serveur gère ses montages et exclusions. Les routes d’administration sont désactivées sur HTTPS.",
              )}{" "}
            </p>
          </details>
        </Show>
      </div>
      <Show when={task()}>
        {(current) => (
          <div class="settings-card">
            <h2>
              {t("Tâche Aède ·")} {taskSource() === "local" ? t("Local") : t("Serveur")}
            </h2>
            <p>
              #{current().task_id} · {current().status}
            </p>
            <div class="settings-actions">
              <button disabled={busy()} onClick={() => void refreshTask()}>
                {t("Actualiser la progression")}{" "}
              </button>
              <button
                disabled={busy() || !["queued", "running"].includes(current().status)}
                onClick={() =>
                  void perform(() =>
                    requestAede(
                      `/api/admin/v1/tasks/${current().task_id}/cancel`,
                      {},
                      "POST",
                      {},
                      taskSource(),
                    ),
                  )
                }
              >
                {t("Annuler la tâche")}{" "}
              </button>
            </div>
            <Show when={current().result}>
              <pre>{current().result?.stdout || current().result?.stderr}</pre>
            </Show>
            <Show when={current().error}>
              <p role="alert">{current().error?.message}</p>
            </Show>
          </div>
        )}
      </Show>
      <Feedback error message={error()} onClose={() => setError("")} />
    </div>
  );
}

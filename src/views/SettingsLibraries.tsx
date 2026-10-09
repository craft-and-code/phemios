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
  const library = useLibrary(),
    [error, setError] = createSignal(""),
    [busy, setBusy] = createSignal(false),
    [full, setFull] = createSignal(false),
    [threads, setThreads] = createSignal(0),
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
      <div class="settings-card">
        <h2>Bibliothèque locale</h2>
        <p>
          Ajoutez vos dossiers, y compris les partages réseau déjà montés par votre système. Leur
          contenu rejoint le catalogue commun avec l’origine Local.
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
            {library.localSession() ? "Reconnecter le moteur local" : "Activer Aède local"}
          </button>
          <button
            disabled={busy() || !library.localSession()}
            onClick={() => void perform(() => library.disableLocal())}
          >
            Désactiver le moteur local
          </button>
          <button disabled={busy() || library.demo} onClick={() => void perform(pickLocalRoots)}>
            Ajouter des dossiers…
          </button>
        </div>
        <Show when={local()?.enabled && !local()?.running}>
          <p class="notice">
            Le moteur local est arrêté. Reconnectez-le pour lire ou modifier la bibliothèque.
          </p>
        </Show>
        <ul class="root-list">
          <For each={local()?.roots}>
            {(root) => (
              <li>
                <div>
                  <strong>{root.path}</strong>
                  <small>
                    {root.available ? "Disponible" : "Indisponible · catalogue conservé"}
                    {root.mount ? ` · ${root.mount}` : ""}
                  </small>
                </div>
                <button
                  disabled={busy()}
                  onClick={() => void perform(() => localRootAction(root.path, "remove"))}
                >
                  Retirer
                </button>
                <button
                  disabled={busy() || !library.localSession()}
                  onClick={() => void perform(() => localRootAction(root.path, "exclude"))}
                >
                  Exclure
                </button>
              </li>
            )}
          </For>
        </ul>
        <p class="muted">
          Ajouter un dossier ne lance aucun scan. Retirer ou exclure un dossier sera appliqué au
          catalogue lors de l’analyse suivante ; les fichiers audio et les annotations sont
          conservés.
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
            Analyser les dossiers
          </button>
          <button
            disabled={busy() || !library.localSession()}
            onClick={() => void perform(() => library.sync("local"))}
          >
            Synchroniser le catalogue local
          </button>
        </div>
        <label class="check">
          <input
            type="checkbox"
            checked={full()}
            onChange={(e) => setFull(e.currentTarget.checked)}
          />
          Relire tous les fichiers
        </label>
        <label>
          Threads (0 = automatique)
          <input
            type="number"
            min="0"
            max="64"
            value={threads()}
            onInput={(e) => setThreads(e.currentTarget.valueAsNumber)}
          />
        </label>
        <details>
          <summary>Exclusions</summary>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void perform(() => localRootAction(excluded(), "exclude"));
            }}
          >
            <label>
              Dossier à exclure
              <input
                required
                value={excluded()}
                onInput={(e) => setExcluded(e.currentTarget.value)}
              />
            </label>
            <div class="settings-actions">
              <button disabled={busy() || !library.localSession()}>Exclure</button>
              <button
                type="button"
                disabled={busy() || !library.localSession()}
                onClick={() => void perform(() => localRootAction(excluded(), "include"))}
              >
                Retirer l’exclusion
              </button>
            </div>
          </form>
          <p class="muted">
            Les exclusions utilisent les règles roots d’Aède. Vous pouvez retirer une exclusion en
            indiquant son chemin.
          </p>
          <For each={roots()?.items.filter((row) => row.status === "excluded")}>
            {(row) => (
              <div class="account-row">
                <span>{row.path}</span>
                <button
                  disabled={busy() || !row.path}
                  onClick={() => void perform(() => localRootAction(row.path!, "include"))}
                >
                  Retirer l’exclusion
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
        <h2>Serveur Aède</h2>
        <ConnectionPanel embedded onClose={() => {}} />
        <Show when={administrative()}>
          <details>
            <summary>Dossiers et scan du serveur</summary>
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
                Dossiers sur le serveur (un chemin absolu par ligne)
                <textarea
                  value={remoteFolders()}
                  onInput={(e) => setRemoteFolders(e.currentTarget.value)}
                />
              </label>
              <button disabled={busy()}>Lancer le scan du serveur</button>
            </form>
            <p class="muted">
              Sans dossier indiqué, Aède analyse ses racines existantes. Le serveur gère ses
              montages et exclusions. Les routes d’administration sont désactivées sur HTTPS.
            </p>
          </details>
        </Show>
      </div>
      <Show when={task()}>
        {(current) => (
          <div class="settings-card">
            <h2>Tâche Aède · {taskSource() === "local" ? "Local" : "Serveur"}</h2>
            <p>
              #{current().task_id} · {current().status}
            </p>
            <div class="settings-actions">
              <button disabled={busy()} onClick={() => void refreshTask()}>
                Actualiser la progression
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
                Annuler la tâche
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
      <p role="alert">{error()}</p>
    </div>
  );
}

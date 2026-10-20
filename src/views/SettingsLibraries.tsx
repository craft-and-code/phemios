import { CoverSize } from "../components/CoverSize";
import { ServerRoots } from "../components/ServerRoots";
import { Feedback } from "../components/Feedback";
import { createToolPreferences } from "../library/tool-preferences";
import { t } from "../i18n";
import { createResource, createSignal, For, Show } from "solid-js";
import { useLibrary } from "../library/context";
import { ConnectionPanel } from "../components/ConnectionPanel";
import {
  localStatus,
  pickLocalRoots,
  scanLocal,
  localRootAction,
  requestAede,
} from "../platform/desktop";
import { createLibraryScan } from "../library/library-scan";
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
    [excluded, setExcluded] = createSignal("");
  const scan = createLibraryScan({
    session: (source) => (source === "local" ? library.localSession() : library.serverSession()),
    tasks: library.tasks,
  });
  const task = scan.task,
    taskSource = scan.source;
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
  const administrative = () => library.serverSession()?.account.role === "admin";
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
  async function refreshTask() {
    await perform(scan.refresh);
  }
  return (
    <div class="settings-libraries">
      <Show when={prefs.error()}>
        <p role="alert">{prefs.error()}</p>
      </Show>
      <div class="settings-card">
        <h2>{t("Affichage de la bibliothèque")}</h2>
        <p>{t("Taille générale des pochettes")}</p>
        <CoverSize
          value={prefs.value().coverSize}
          disabled={false}
          onChange={(coverSize) => prefs.update({ coverSize, coverSizes: {} })}
        />
        <p class="muted">
          {t(
            "Ce réglage s’applique à Albums, Compilations et Genres. Leurs réglettes permettent ensuite une taille différente par vue.",
          )}
        </p>
        <label class="check">
          <input
            type="checkbox"
            checked={prefs.value().showMissingAlbums}
            onChange={(event) => prefs.update({ showMissingAlbums: event.currentTarget.checked })}
          />
          {t("Afficher les albums manquants dans les discographies")}
        </label>
      </div>
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
              void perform(() => scan.start("local", () => scanLocal(full(), threads())))
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
            <Feedback error persistent message={String(roots.error)} />
          </Show>
        </details>
      </div>
      <div class="settings-card">
        <h2>{t("Serveur Aède")}</h2>
        <ConnectionPanel embedded onClose={() => {}} />
        <Show when={administrative()}>
          <ServerRoots
            busy={
              busy() ||
              (taskSource() === "server" && ["queued", "running"].includes(task()?.status ?? ""))
            }
            revision={
              taskSource() === "server" && task()?.status === "completed" ? task()!.task_id : 0
            }
            scan={() =>
              void perform(async () => {
                await scan.start("server", (owner) =>
                  requestAede<{ task_id: number; status: "queued" }>(
                    "/api/admin/v1/scan",
                    {},
                    "POST",
                    { full: full(), threads: threads() },
                    "server",
                    owner,
                  ),
                );
              })
            }
          />
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
                onClick={() => void perform(scan.cancel)}
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

import { ExcludedFolders } from "../components/ExcludedFolders";
import { Icon } from "../components/Icon";
import { ActionButton } from "../components/ActionButton";
import { ServerCacheSettings } from "../components/ServerCacheSettings";
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
    [action, setAction] = createSignal(""),
    [message, setMessage] = createSignal("");
  const scan = createLibraryScan({
    session: (source) => (source === "local" ? library.localSession() : library.serverSession()),
    tasks: library.tasks,
  });
  const task = scan.task,
    taskSource = scan.source;
  const [local, { refetch }] = createResource(() => !library.demo, localStatus);
  const administrative = () => library.serverSession()?.account.role === "admin";
  async function perform(work: () => Promise<unknown>, name = "", success = "") {
    if (busy()) return;
    setError("");
    setMessage("");
    setAction(name);
    setBusy(true);
    try {
      await work();
      await refetch();
      if (["start", "stop", "sync"].includes(name) && library.error()) setError(library.error());
      else if (success) setMessage(success);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
      setAction("");
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
          <ActionButton
            class="primary"
            busy={action() === "start"}
            disabled={
              busy() ||
              library.busy() ||
              library.demo ||
              (!!library.localSession() && !!local()?.running)
            }
            onClick={() =>
              void perform(
                () => library.enableLocal(),
                "start",
                t("Aède local est démarré et son catalogue a été chargé."),
              )
            }
          >
            {library.localSession() && local()?.running
              ? t("Aède local actif")
              : t("Démarrer Aède local")}
          </ActionButton>
          <button
            disabled={busy() || !library.localSession()}
            onClick={() =>
              void perform(
                () => library.disableLocal(),
                "stop",
                t("Aède local est arrêté. Son catalogue reste consultable hors ligne."),
              )
            }
          >
            {t("Désactiver le moteur local")}{" "}
          </button>
          <button disabled={busy() || library.demo} onClick={() => void perform(pickLocalRoots)}>
            {t("Ajouter des dossiers…")}{" "}
          </button>
        </div>
        <p role="status">
          {library.localSession() && local()?.running
            ? t("Le moteur local est actif et connecté à Phémios.")
            : t("Le moteur local n’est pas connecté à Phémios.")}
        </p>
        <Show when={local()?.enabled && !local()?.running}>
          <p class="notice">
            {t(
              "Le moteur local est arrêté. Reconnectez-le pour lire ou modifier la bibliothèque.",
            )}{" "}
          </p>
        </Show>
        <p class="muted">
          {t(
            "Ajouter un dossier ne lance aucun scan. Retirer ou exclure un dossier sera appliqué au catalogue lors de l’analyse suivante ; les fichiers audio et les annotations sont conservés.",
          )}{" "}
        </p>
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
                  class="icon-button quiet"
                  title={t("Retirer le dossier")}
                  aria-label={t("Retirer le dossier")}
                  disabled={busy() || library.demo}
                  onClick={() => void perform(() => localRootAction(root.path, "remove"))}
                >
                  <Icon name="minus" />
                </button>
              </li>
            )}
          </For>
        </ul>

        <ExcludedFolders
          disabled={
            busy() ||
            (taskSource() === "local" && ["queued", "running"].includes(task()?.status ?? ""))
          }
        />
        <div class="settings-actions">
          <ActionButton
            busy={action() === "scan"}
            disabled={
              busy() ||
              library.busy() ||
              !library.localSession() ||
              !local()?.roots.length ||
              ["queued", "running"].includes(task()?.status ?? "")
            }
            onClick={() =>
              void perform(
                () => scan.start("local", () => scanLocal(full(), threads())),
                "scan",
                t("Scan lancé. Le catalogue sera actualisé à la fin de la tâche."),
              )
            }
          >
            {t("Scanner les dossiers")}
          </ActionButton>
          <ActionButton
            busy={action() === "sync"}
            disabled={busy() || library.busy() || !library.localSession()}
            onClick={() =>
              void perform(
                () => library.sync("local"),
                "sync",
                t("Le catalogue local connu par Aède a été rechargé dans Phémios."),
              )
            }
          >
            {t("Recharger le catalogue local")}
          </ActionButton>
        </div>
        <p class="muted">
          {t("Scanner les dossiers recherche les fichiers ajoutés, déplacés ou retirés.")}
          <br />
          {t(
            "Recharger le catalogue actualise uniquement les informations déjà connues par Aède, sans parcourir vos fichiers.",
          )}
        </p>
        <Feedback message={message()} onClose={() => setMessage("")} />
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
      </div>
      <div class="settings-card">
        <h2>{t("Serveur Aède")}</h2>
        <ConnectionPanel embedded onClose={() => {}} />
        <ServerCacheSettings />
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

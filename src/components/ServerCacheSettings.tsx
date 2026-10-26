import { createEffect, createMemo, createSignal, onCleanup, Show } from "solid-js";
import { useLibrary } from "../library/context";
import { t } from "../i18n";
import { ActionButton } from "./ActionButton";
import { Feedback } from "./Feedback";
/** Device-wide public cache controls never delete remote music or personal account data. */
export function ServerCacheSettings() {
  const library = useLibrary();
  const [confirm, setConfirm] = createSignal(false),
    [clearing, setClearing] = createSignal(false);
  const [message, setMessage] = createSignal(""),
    [error, setError] = createSignal("");
  let alive = true;
  onCleanup(() => {
    alive = false;
  });
  const scope = createMemo(() => ({ owner: library.serverSession() }));
  createEffect(() => {
    scope();
    setConfirm(false);
    setMessage("");
    setError("");
  });
  const disabled = () => library.demo || !!library.serverSession() || library.busy() || clearing();
  async function clear() {
    if (disabled()) return;
    const held = scope();
    const current = () => alive && held === scope();
    setClearing(true);
    setError("");
    setMessage("");
    try {
      await library.clearServerCache();
      if (current()) {
        setConfirm(false);
        setMessage(t("Copie hors ligne du serveur distant supprimée."));
      }
    } catch (failure) {
      if (current()) setError(String(failure));
    } finally {
      if (alive) setClearing(false);
    }
  }
  return (
    <div class="settings-cache">
      <h3>{t("Catalogue serveur hors ligne")}</h3>
      <p>
        {t(
          "Ce réglage efface uniquement la copie hors ligne du serveur distant : catalogue et images en cache. Le catalogue Local, les articles enregistrés et les enrichissements conservés par Aède restent disponibles.",
        )}
      </p>
      <Show
        when={library.serverCache()}
        fallback={<p class="muted">{t("Aucun catalogue serveur conservé en mémoire.")}</p>}
      >
        <p>
          {library.serverCacheHidden()
            ? t("Catalogue serveur masqué hors ligne.")
            : t("Catalogue serveur visible hors ligne.")}
        </p>
      </Show>
      <div class="settings-actions">
        <ActionButton
          icon={library.serverCacheHidden() ? "eye" : "eye-off"}
          disabled={disabled() || !library.serverCache()}
          onClick={() => {
            setError("");
            setMessage("");
            try {
              library.setServerCacheHidden(!library.serverCacheHidden());
            } catch (failure) {
              setError(String(failure));
            }
          }}
        >
          {library.serverCacheHidden()
            ? t("Réafficher le catalogue serveur")
            : t("Masquer le catalogue serveur")}
        </ActionButton>
        <ActionButton icon="trash" disabled={disabled()} onClick={() => setConfirm(true)}>
          {t("Vider le cache serveur…")}
        </ActionButton>
      </div>
      <Show when={library.serverSession()}>
        <p class="muted">{t("Déconnectez le serveur pour masquer ou vider son cache.")}</p>
      </Show>
      <Show when={confirm()}>
        <p>
          {t(
            "Supprimer la copie du catalogue et les images du serveur distant sur cet appareil ? Le catalogue Local et les données d’Aède sont conservés. Une reconnexion et une synchronisation récupéreront les données du serveur.",
          )}
        </p>
        <div class="settings-actions">
          <ActionButton busy={clearing()} disabled={disabled()} onClick={() => void clear()}>
            {t("Vider le cache")}
          </ActionButton>
          <button disabled={clearing()} onClick={() => setConfirm(false)}>
            {t("Annuler")}
          </button>
        </div>
      </Show>
      <Feedback message={message()} onClose={() => setMessage("")} />
      <Feedback error message={error()} onClose={() => setError("")} />
    </div>
  );
}

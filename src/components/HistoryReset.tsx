import { createEffect, createSignal, Show } from "solid-js";
import { useLibrary } from "../library/context";
import { requestAede } from "../platform/desktop";
/** Explicit confirmation mirrors Aède's atomic history/counter reset for this owner only. */
export function HistoryReset(props: { onReset: () => void }) {
  const library = useLibrary(),
    [confirm, setConfirm] = createSignal(false),
    [busy, setBusy] = createSignal(false),
    [message, setMessage] = createSignal("");
  createEffect(() => {
    void library.session();
    setConfirm(false);
    setMessage("");
  });
  const writable = () =>
    library.connected() && ["user", "admin"].includes(library.session()?.account.role ?? "");
  async function reset() {
    if (!writable() || busy()) return;
    const account = library.session();
    setBusy(true);
    setMessage("");
    try {
      await requestAede("/api/me/v1/history", {}, "DELETE", { confirm: true });
      if (account !== library.session()) return;
      setConfirm(false);
      setMessage("Écoutes et compteurs réinitialisés.");
      props.onReset();
    } catch (e) {
      if (account === library.session()) setMessage(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <button disabled={!writable() || busy()} onClick={() => setConfirm(true)}>
        Réinitialiser l’historique
      </button>
      <Show when={confirm()}>
        <div class="history-confirm" role="group" aria-label="Confirmer la réinitialisation">
          <p>
            Effacer toutes les écoutes, les scrobbles et leurs compteurs pour ce compte ? Les
            favoris, notes et collections sont conservés. Une lecture en cours pourra ensuite
            ajouter une nouvelle écoute.
          </p>
          <button disabled={!writable() || busy()} onClick={() => void reset()}>
            Effacer mon historique
          </button>
          <button disabled={busy()} onClick={() => setConfirm(false)}>
            Annuler
          </button>
        </div>
      </Show>
      <p role="status">{message()}</p>
    </>
  );
}

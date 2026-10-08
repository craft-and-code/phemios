import { createSignal, onMount, onCleanup, Show } from "solid-js";
import { Icon } from "./Icon";
import { useLibrary } from "../library/context";
import { requestAede } from "../platform/desktop";
import type { Filters } from "../library/types";
/** Freeze the criteria at opening; Aède evaluates their future catalog matches. */
export function SelectionCollection(props: { section: string; filters: Filters }) {
  const library = useLibrary(),
    [draft, setDraft] = createSignal<string>(),
    [name, setName] = createSignal(""),
    [error, setError] = createSignal(""),
    [busy, setBusy] = createSignal(false),
    [message, setMessage] = createSignal("");
  const writable = () =>
    library.connected() && ["user", "admin"].includes(library.session()?.account.role ?? "");
  async function save() {
    const expression = draft();
    if (!expression || busy()) return;
    const account = library.session()?.account.id;
    setBusy(true);
    setError("");
    try {
      await requestAede("/api/me/v1/collection", { name: name() }, "PUT", {
        expression,
        create_only: true,
      });
      if (account !== library.session()?.account.id) return;
      setDraft(undefined);
      setMessage(`Collection « ${name()} » enregistrée. Elle suit ces filtres.`);
    } catch (e) {
      if (account === library.session()?.account.id)
        setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <button
        class="icon-button"
        disabled={!writable()}
        aria-label="Créer une collection dynamique depuis ces filtres"
        title="Créer une collection depuis ces filtres"
        onClick={() => {
          setName("");
          setError("");
          setMessage("");
          setDraft(`browse-v1:${JSON.stringify({ ...props.filters, view: props.section })}`);
        }}
      >
        <Icon name="library" />
      </button>
      <Show when={message()}>
        <span role="status">{message()}</span>
      </Show>
      <Show when={draft()}>
        {(_draft) => {
          let dialog: HTMLDialogElement | undefined;
          onMount(() => dialog?.showModal());
          onCleanup(() => dialog?.close());
          return (
            <dialog
              ref={(element) => {
                dialog = element;
              }}
              class="collection-dialog"
              aria-label="Créer une collection dynamique"
              onCancel={(e) => {
                e.preventDefault();
                if (!busy()) setDraft(undefined);
              }}
              onClick={(e) => {
                if (e.target === e.currentTarget && !busy()) setDraft(undefined);
              }}
            >
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void save();
                }}
              >
                <div class="section-heading">
                  <h2>Créer une collection</h2>
                  <button
                    type="button"
                    class="icon-button quiet"
                    aria-label="Fermer"
                    disabled={busy()}
                    onClick={() => setDraft(undefined)}
                  >
                    <Icon name="close" />
                  </button>
                </div>
                <p>
                  Les années, lettres, pays, genre et recherche actuellement sélectionnés seront
                  conservés. Les futurs albums correspondants rejoindront cette collection.
                </p>
                <label>
                  Nom
                  <input
                    autofocus
                    required
                    maxlength="128"
                    value={name()}
                    onInput={(e) => setName(e.currentTarget.value)}
                  />
                </label>
                <p role="alert">{error()}</p>
                <button class="primary" disabled={!writable() || busy()}>
                  Créer la collection
                </button>
              </form>
            </dialog>
          );
        }}
      </Show>
    </>
  );
}

import { t } from "../i18n";
import { createSignal, onMount, onCleanup, Show } from "solid-js";
import { Icon } from "./Icon";
import { useLibrary } from "../library/context";
import { saveBrowsingCollection } from "../library/collection-save";
import type { Filters } from "../library/types";
/** Freeze the criteria at opening; Aède evaluates their future catalog matches. */
export function SelectionCollection(props: {
  section?: string;
  filters?: Filters;
  expression?: string;
}) {
  const library = useLibrary(),
    [draft, setDraft] = createSignal<string>(),
    [name, setName] = createSignal(""),
    [error, setError] = createSignal(""),
    [busy, setBusy] = createSignal(false),
    [message, setMessage] = createSignal("");
  const writable = () =>
    !!library.session() && ["user", "admin"].includes(library.session()?.account.role ?? "");
  async function save() {
    const expression = draft();
    if (!expression || busy()) return;
    const account = library.session();
    setBusy(true);
    setError("");
    try {
      await saveBrowsingCollection(name(), expression, () => account === library.session());
      if (account !== library.session()) return;
      setDraft(undefined);
      setMessage(t("Collection « {0} » enregistrée. Elle suit ces filtres.", name()));
    } catch (e) {
      if (account === library.session()) setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <button
        class="icon-button"
        disabled={!writable()}
        aria-label={t("Créer une collection depuis cette sélection")}
        title={t("Créer une collection depuis ces filtres")}
        onClick={() => {
          setName("");
          setError("");
          setMessage("");
          const criteria = { ...props.filters, view: props.section };
          if (!criteria.genres?.length) delete criteria.genres;
          setDraft(props.expression ?? `browse-v1:${JSON.stringify(criteria)}`);
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
              aria-label={t("Créer une collection")}
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
                  <h2>
                    {t("Créer une collection ·")}{" "}
                    {library.source() === "local" ? t("Local") : t("Serveur")}
                  </h2>
                  <button
                    type="button"
                    class="icon-button quiet"
                    aria-label={t("Fermer")}
                    disabled={busy()}
                    onClick={() => setDraft(undefined)}
                  >
                    <Icon name="close" />
                  </button>
                </div>
                <p>{t("La collection conservera les critères de cette sélection.")} </p>
                <label>
                  {t("Nom")}{" "}
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
                  {t("Créer la collection")}{" "}
                </button>
              </form>
            </dialog>
          );
        }}
      </Show>
    </>
  );
}

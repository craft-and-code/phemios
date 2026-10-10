import { Feedback } from "./Feedback";
import { t } from "../i18n";
import { createSignal, onMount, onCleanup, Show } from "solid-js";
import { Icon } from "./Icon";
import { useLibrary } from "../library/context";
import { saveBrowsingCollection } from "../library/collection-save";
import type { SourceId } from "../library/sources";
import type { Filters } from "../library/types";
/** Freeze the criteria at opening; Aède evaluates their future catalog matches. */
export function SelectionCollection(props: {
  section?: string;
  filters?: Filters;
  expression?: string;
  disabled?: boolean;
  source?: SourceId;
}) {
  const library = useLibrary(),
    [draft, setDraft] = createSignal<string>(),
    [draftSource, setDraftSource] = createSignal<SourceId>(library.source()),
    [draftAccount, setDraftAccount] = createSignal<ReturnType<typeof library.session>>(),
    [name, setName] = createSignal(""),
    [error, setError] = createSignal(""),
    [busy, setBusy] = createSignal(false),
    [message, setMessage] = createSignal("");
  const source = () => props.source ?? library.source();
  const session = (source: SourceId) =>
    source === "local" ? library.localSession() : library.serverSession();
  const writable = () =>
    !!session(source()) && ["user", "admin"].includes(session(source())?.account.role ?? "");
  async function save() {
    const expression = draft();
    if (!expression || busy()) return;
    const owner = draftSource(),
      account = draftAccount();
    if (!account || account !== session(owner)) {
      setError(t("Session invalide."));
      return;
    }
    setBusy(true);
    setError("");
    try {
      await saveBrowsingCollection(name(), expression, () => account === session(owner), owner);
      if (account !== session(owner)) return;
      setDraft(undefined);
      setMessage(t("Collection « {0} » enregistrée. Elle suit ces filtres.", name()));
    } catch (e) {
      if (account === session(owner)) setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div class="selection-collection">
      <button
        class="icon-button"
        disabled={!writable() || props.disabled}
        aria-label={t("Créer une collection depuis cette sélection")}
        title={t("Créer une collection depuis ces filtres")}
        onClick={() => {
          setDraftSource(source());
          setDraftAccount(session(source()));
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
        <Feedback
          class="selection-collection-notice"
          message={message()}
          onClose={() => setMessage("")}
        />
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
                    {draftSource() === "local" ? t("Local") : t("Serveur")}
                  </h2>
                  <button
                    type="button"
                    class="icon-button quiet icon-close"
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
                <Feedback error message={error()} onClose={() => setError("")} />
                <button class="primary" disabled={!writable() || busy()}>
                  {t("Créer la collection")}{" "}
                </button>
              </form>
            </dialog>
          );
        }}
      </Show>
    </div>
  );
}

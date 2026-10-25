import { Feedback } from "./Feedback";
import { createSignal, Show } from "solid-js";
import type { JSX } from "solid-js";
import { t } from "../i18n";
import { useLibrary } from "../library/context";
import { renameSavedCollection } from "../library/collection-rename";
import { Icon } from "./Icon";
/** Inline focused name editing keeps the existing rule and dates on the authenticated owner. */
export function RenameCollection(props: {
  id?: string | undefined;
  name: string;
  children?: JSX.Element;
  onRenamed: (name: string) => void;
}) {
  const library = useLibrary(),
    [editing, setEditing] = createSignal(false),
    [name, setName] = createSignal(props.name),
    [busy, setBusy] = createSignal(false),
    [error, setError] = createSignal("");
  let input: HTMLInputElement | undefined;
  const writable = () => !!library.session() && library.session()?.account.role !== "auditor";
  async function save() {
    if (busy() || !writable()) return;
    const session = library.session(),
      source = library.source(),
      held = props.name;
    setBusy(true);
    setError("");
    const current = () =>
      session === library.session() && source === library.source() && held === props.name;
    try {
      if (await renameSavedCollection(held, name(), source, current, props.id, session)) {
        setEditing(false);
        props.onRenamed(name().trim());
      }
    } catch (failure) {
      if (current()) setError(String(failure));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div class="collection-name">
      <Show when={editing()} fallback={<strong>{props.name}</strong>}>
        <form
          class="collection-name-editor"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <input
            ref={(element) => {
              input = element;
            }}
            required
            maxlength="256"
            aria-label={t("Nom de la collection")}
            value={name()}
            disabled={busy()}
            onInput={(e) => setName(e.currentTarget.value)}
          />
          <button
            class="icon-button"
            disabled={busy()}
            aria-label={t("Enregistrer le nom")}
            title={t("Enregistrer le nom")}
          >
            <Icon name="check" />
          </button>
          <button
            type="button"
            class="icon-button quiet icon-close"
            disabled={busy()}
            aria-label={t("Annuler")}
            onClick={() => {
              setEditing(false);
              setError("");
            }}
          >
            <Icon name="close" />
          </button>
        </form>
      </Show>
      {props.children}
      <Show when={!editing()}>
        <button
          class="icon-button quiet"
          aria-label={t("Renommer {0}", props.name)}
          title={t("Renommer la collection")}
          disabled={!writable()}
          onClick={() => {
            setName(props.name);
            setError("");
            setEditing(true);
            queueMicrotask(() => {
              input?.focus();
              input?.select();
            });
          }}
        >
          <Icon name="edit" />
        </button>
      </Show>
      <Show when={error()}>
        <Feedback error message={error()} onClose={() => setError("")} />
      </Show>
    </div>
  );
}

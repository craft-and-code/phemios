import { t, locale } from "../i18n";
import { createEffect, createSignal, For, onMount, onCleanup, Show } from "solid-js";
import type { mountNoteEditor, NoteCommand } from "../editor/milkdown";
import { Icon } from "./Icon";
const commands: readonly { name: NoteCommand; label: string; icon: string }[] = [
  { name: "bold", label: t("Gras"), icon: "bold" },
  { name: "italic", label: t("Italique"), icon: "italic" },
  { name: "heading", label: t("Titre"), icon: "heading" },
  { name: "paragraph", label: t("Paragraphe"), icon: "paragraph" },
  { name: "bullet", label: t("Liste à puces"), icon: "list" },
  { name: "ordered", label: t("Liste numérotée"), icon: "ordered" },
  { name: "quote", label: t("Citation"), icon: "quote" },
  { name: "undo", label: t("Annuler la modification"), icon: "undo" },
  { name: "redo", label: t("Rétablir la modification"), icon: "redo" },
];
/** The editor is loaded only on detail pages and destroyed on navigation. */
export function NoteEditor(props: {
  value: string;
  disabled: boolean;
  viewOnly?: boolean;
  onChange: (value: string) => void;
  onRead: (read: () => string) => void;
  onUnavailable: (value: boolean) => void;
}) {
  let host: HTMLDivElement | undefined,
    editor: Awaited<ReturnType<typeof mountNoteEditor>> | undefined,
    disposed = false;
  const [ready, setReady] = createSignal(false),
    [error, setError] = createSignal(""),
    [revision, setRevision] = createSignal(0);
  onMount(async () => {
    try {
      const { mountNoteEditor } = await import("../editor/milkdown");
      if (disposed || !host) return;
      const created = await mountNoteEditor(host, props.value, props.disabled, props.onChange, () =>
        setRevision((value) => value + 1),
      );
      if (disposed) {
        await created.destroy();
        return;
      }
      editor = created;
      props.onRead(created.read);
      setReady(true);
      props.onUnavailable(false);
    } catch (failure) {
      if (!disposed)
        setError(failure instanceof Error ? failure.message : t("Éditeur indisponible."));
    }
  });
  createEffect(() => {
    locale();
    if (ready()) editor?.set(props.value, props.disabled);
  });
  onCleanup(() => {
    disposed = true;
    void editor?.destroy();
  });
  return (
    <div
      class="note-editor"
      classList={{ "note-readonly": props.disabled, "note-view": props.viewOnly ?? false }}
    >
      <Show when={!props.viewOnly}>
        <div class="note-toolbar" role="toolbar" aria-label={t("Mise en forme des notes")}>
          <For each={commands}>
            {(item) => (
              <button
                type="button"
                class="icon-button"
                title={t(item.label)}
                aria-label={t(item.label)}
                aria-pressed={(revision(), ready() && editor?.active(item.name)) ?? false}
                disabled={props.disabled || !ready()}
                onPointerDown={(event) => event.preventDefault()}
                onClick={() => editor?.command(item.name)}
              >
                <Icon name={item.icon} />
              </button>
            )}
          </For>
        </div>
      </Show>
      <div
        ref={(element) => {
          host = element;
        }}
        class="note-document"
      />
      <Show when={!ready() && !error()}>
        <small>{t("Chargement de l’éditeur…")}</small>
      </Show>
      <Show when={error()}>
        <p role="alert">
          {t("Éditeur indisponible :")} {error()}
        </p>
        <pre>{props.value}</pre>
      </Show>
    </div>
  );
}

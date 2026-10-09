import {
  Editor,
  rootCtx,
  defaultValueCtx,
  editorViewOptionsCtx,
  editorViewCtx,
  serializerCtx,
} from "@milkdown/kit/core";
import {
  commonmark,
  imageSchema,
  linkSchema,
  toggleStrongCommand,
  toggleEmphasisCommand,
  wrapInHeadingCommand,
  turnIntoTextCommand,
  wrapInBulletListCommand,
  wrapInOrderedListCommand,
  wrapInBlockquoteCommand,
} from "@milkdown/kit/preset/commonmark";
import { listener, listenerCtx } from "@milkdown/kit/plugin/listener";
import { history, undoCommand, redoCommand } from "@milkdown/kit/plugin/history";
import { callCommand, replaceAll } from "@milkdown/kit/utils";
import { markdownDraft } from "./draft";
const documentAttributes = (readOnly: boolean): Record<string, string> => ({
  role: readOnly ? "document" : "textbox",
  "aria-label": "Notes personnelles",
  ...(readOnly ? {} : { "aria-multiline": "true" }),
});
export type NoteCommand =
  "bold" | "italic" | "heading" | "paragraph" | "bullet" | "ordered" | "quote" | "undo" | "redo";
/** Markdown images and links retain their data without fetching or navigating on display. */
const inertImage = imageSchema.extendSchema((previous) => (ctx) => ({
  ...previous(ctx),
  toDOM: (node) => [
    "span",
    { class: "note-media" },
    `Image : ${node.attrs.alt || "sans description"}`,
  ],
}));
const inertLink = linkSchema.extendSchema((previous) => (ctx) => ({
  ...previous(ctx),
  toDOM: () => ["span", { class: "note-link" }, 0],
}));
/** Host-neutral visual editing; stored content remains Markdown, never executable HTML. */
export async function mountNoteEditor(
  element: HTMLElement,
  initial: string,
  disabled: boolean,
  publish: (value: string) => void,
  changed: () => void,
) {
  const draft = markdownDraft(initial, publish);
  const editor = Editor.make()
    .config((ctx) => {
      ctx.set(rootCtx, element);
      ctx.set(defaultValueCtx, initial);
      ctx.update(editorViewOptionsCtx, (previous) => ({
        ...previous,
        editable: () => !disabled,
        attributes: documentAttributes(disabled),
      }));
      ctx.get(listenerCtx).markdownUpdated((_ctx, value) => {
        draft.changed(value);
        changed();
      });
      ctx.get(listenerCtx).selectionUpdated(() => changed());
    })
    .use(
      commonmark.filter(
        (plugin) =>
          !imageSchema.some((item) => item === plugin) &&
          !linkSchema.some((item) => item === plugin),
      ),
    )
    .use(inertImage)
    .use(inertLink)
    .use(listener)
    .use(history);
  await editor.create();
  const markdown = () =>
    editor.action((ctx) => ctx.get(serializerCtx)(ctx.get(editorViewCtx).state.doc));
  draft.initialized(markdown());
  const command = (name: NoteCommand) => {
    editor.action((ctx) => ctx.get(editorViewCtx).focus());
    switch (name) {
      case "bold":
        editor.action(callCommand(toggleStrongCommand.key));
        break;
      case "italic":
        editor.action(callCommand(toggleEmphasisCommand.key));
        break;
      case "heading":
        editor.action(callCommand(wrapInHeadingCommand.key, 2));
        break;
      case "paragraph":
        editor.action(callCommand(turnIntoTextCommand.key));
        break;
      case "bullet":
        editor.action(callCommand(wrapInBulletListCommand.key));
        break;
      case "ordered":
        editor.action(callCommand(wrapInOrderedListCommand.key));
        break;
      case "quote":
        editor.action(callCommand(wrapInBlockquoteCommand.key));
        break;
      case "undo":
        editor.action(callCommand(undoCommand.key));
        break;
      case "redo":
        editor.action(callCommand(redoCommand.key));
        break;
    }
  };
  return {
    command,
    read: () => draft.read(markdown()),
    set(value: string, readOnly: boolean) {
      editor.action((ctx) =>
        ctx
          .get(editorViewCtx)
          .setProps({ editable: () => !readOnly, attributes: documentAttributes(readOnly) }),
      );
      if (draft.differs(value))
        draft.replace(value, () => {
          editor.action(replaceAll(value));
          return markdown();
        });
    },
    active(name: NoteCommand) {
      return editor.action((ctx) => {
        const state = ctx.get(editorViewCtx).state,
          marks = state.storedMarks ?? state.selection.$from.marks();
        if (name === "bold" || name === "italic")
          return marks.some((mark) => mark.type.name === (name === "bold" ? "strong" : "emphasis"));
        const types: Partial<Record<NoteCommand, string>> = {
          heading: "heading",
          bullet: "bullet_list",
          ordered: "ordered_list",
          quote: "blockquote",
        };
        for (let depth = state.selection.$from.depth; depth > 0; depth--)
          if (state.selection.$from.node(depth).type.name === types[name]) return true;
        return false;
      });
    },
    destroy: () => editor.destroy(),
  };
}

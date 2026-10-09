import { t } from "../i18n";
import {
  createEffect,
  createMemo,
  createSignal,
  createUniqueId,
  For,
  on,
  onMount,
  Show,
} from "solid-js";
import { commitTags, tagSuggestions } from "../library/tags";
import { Icon } from "./Icon";
/** Token editor with a current-owner saved vocabulary and a readable pending fragment on save. */
export function TagInput(props: {
  value: readonly string[];
  vocabulary: readonly string[];
  disabled: boolean;
  resetKey: string;
  onChange: (tags: string[]) => void;
  onPending: (pending: boolean) => void;
  onRead: (read: () => string[]) => void;
}) {
  const id = createUniqueId(),
    [draft, setDraft] = createSignal(""),
    [open, setOpen] = createSignal(false),
    [active, setActive] = createSignal(-1);
  const suggestions = createMemo(() => tagSuggestions(props.vocabulary, draft(), props.value));
  const fragment = (value: string) => {
    setDraft(value);
    props.onPending(!!value.trim());
    setActive(-1);
  };
  const commit = (value = draft()) => {
    const tags = commitTags(props.value, value);
    props.onChange(tags);
    fragment("");
    setOpen(false);
    return tags;
  };
  createEffect(
    on(
      () => props.resetKey,
      () => {
        fragment("");
        setOpen(false);
      },
    ),
  );
  onMount(() => props.onRead(() => commit()));
  return (
    <div class="tag-editor">
      <label for={id}>{t("Tags")}</label>
      <div class="tag-field" classList={{ disabled: props.disabled }}>
        <input
          id={id}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open() && !!suggestions().length}
          aria-controls={`${id}-suggestions`}
          aria-activedescendant={
            active() >= 0 && active() < suggestions().length
              ? `${id}-option-${active()}`
              : undefined
          }
          disabled={props.disabled}
          value={draft()}
          placeholder={t("Ajouter un tag…")}
          autocomplete="off"
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onInput={(event) => {
            const value = event.currentTarget.value,
              pieces = value.split(",");
            if (pieces.length > 1) {
              props.onChange(commitTags(props.value, pieces.slice(0, -1).join(",")));
              event.currentTarget.value = pieces.at(-1) ?? "";
            }
            fragment(pieces.at(-1) ?? "");
            setOpen(true);
          }}
          onKeyDown={(event) => {
            if (event.isComposing) return;
            if (event.key === "Enter" || event.key === ",") {
              event.preventDefault();
              commit(
                event.key === "Enter" && active() >= 0
                  ? (suggestions()[active()] ?? draft())
                  : draft(),
              );
            } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              event.preventDefault();
              setOpen(true);
              setActive((value) =>
                suggestions().length
                  ? (value + (event.key === "ArrowDown" ? 1 : -1) + suggestions().length) %
                    suggestions().length
                  : -1,
              );
            } else if (event.key === "Escape") {
              event.preventDefault();
              setOpen(false);
              setActive(-1);
            } else if (event.key === "Backspace" && !draft() && props.value.length)
              props.onChange(props.value.slice(0, -1));
          }}
        />
      </div>
      <Show when={open() && suggestions().length}>
        <ul
          id={`${id}-suggestions`}
          class="tag-suggestions"
          role="listbox"
          aria-label={t("Tags enregistrés proposés")}
        >
          <For each={suggestions()}>
            {(tag, index) => (
              <li
                id={`${id}-option-${index()}`}
                role="option"
                aria-selected={active() === index()}
                onPointerDown={(event) => event.preventDefault()}
                onClick={() => commit(tag)}
              >
                {tag}
              </li>
            )}
          </For>
        </ul>
      </Show>
      <div class="tag-pills" aria-label={t("Tags validés")}>
        <For each={props.value}>
          {(tag, index) => (
            <span class="tag-pill">
              {tag}
              <button
                class="tag-remove"
                disabled={props.disabled}
                aria-label={t("Retirer le tag {0}", tag)}
                onClick={() => props.onChange(props.value.filter((_, i) => i !== index()))}
              >
                <Icon name="close" />
              </button>
            </span>
          )}
        </For>
      </div>
      <small>
        {t(
          "Entrée ou virgule pour créer une pastille. Les tags sont enregistrés avec les notes.",
        )}{" "}
      </small>
    </div>
  );
}

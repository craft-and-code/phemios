import { createObjectListDrag } from "./object-list-drag";
import { createEffect, createUniqueId, For, Show, onCleanup } from "solid-js";
import type { JSX } from "solid-js";
import { createObjectListSelection } from "./object-list-selection";
/** Bounded list with optional multiple selection; the owner admits edits and dragging. */
export function ObjectList(props: {
  label: string;
  items: readonly string[];
  selected: string | undefined;
  onSelect: (id: string) => void;
  selectedItems?: readonly string[] | undefined;
  onSelectMany?: ((ids: readonly string[]) => void) | undefined;
  empty: string;
  disabled?: boolean | undefined;
  busy?: boolean | undefined;
  identity?: unknown;
  onDelete?: (() => void | Promise<void>) | undefined;
  onActivate?: ((id: string) => void) | undefined;
  onReorder?: ((id: string, before?: string) => void | Promise<void>) | undefined;
  onDragStart?: ((id: string) => void) | undefined;
  onPointerOver?: ((hit: Element | null, y: number) => void) | undefined;
  onPointerDrop?: ((hit: Element | null, y: number) => void) | undefined;
  onDragEnd?: (() => void) | undefined;
  render?: ((id: string) => JSX.Element) | undefined;
  itemLabel?: ((id: string) => string) | undefined;
  listRef?: ((list: HTMLUListElement) => void) | undefined;
}) {
  const id = createUniqueId();
  const selection = createObjectListSelection(props);
  let list!: HTMLUListElement,
    alive = true;
  onCleanup(() => {
    alive = false;
  });
  createEffect(() => {
    const index = props.items.indexOf(selection.active() ?? "");
    if (index >= 0) list?.children[index]?.scrollIntoView({ block: "nearest" });
  });
  const drag = createObjectListDrag(
    props,
    () => list,
    (key) => selection.click(key, {}),
  );
  return (
    <ul
      ref={(node) => {
        list = node;
        props.listRef?.(node);
      }}
      class="object-list"
      role="listbox"
      aria-label={props.label}
      aria-busy={props.busy}
      aria-disabled={props.disabled}
      aria-multiselectable={props.onSelectMany ? true : undefined}
      tabindex={props.disabled ? -1 : 0}
      aria-activedescendant={
        selection.active() ? `${id}-${props.items.indexOf(selection.active()!)}` : undefined
      }
      onDragOver={drag.nativeOver}
      onDragLeave={drag.nativeLeave}
      onDrop={drag.nativeDrop}
      onKeyDown={(event) => {
        if (props.disabled || event.isComposing) return;
        if (event.metaKey || event.ctrlKey) {
          if (!event.altKey && event.key.toLowerCase() === "a" && selection.all()) {
            event.preventDefault();
            return;
          }
          if (!event.shiftKey || !["ArrowUp", "ArrowDown", "Home", "End"].includes(event.key))
            return;
        }
        const selected = selection.active(),
          index = props.items.indexOf(selected ?? "");
        if (event.altKey) {
          if (selected && props.onReorder && ["ArrowUp", "ArrowDown"].includes(event.key)) {
            event.preventDefault();
            if (
              index >= 0 &&
              ((event.key === "ArrowUp" && index > 0) ||
                (event.key === "ArrowDown" && index < props.items.length - 1))
            )
              void props.onReorder(
                selected,
                event.key === "ArrowUp" ? props.items[index - 1] : props.items[index + 2],
              );
          }
          return;
        }
        if (["ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) {
          event.preventDefault();
          selection.move(event.key, event);
        } else if (
          ["Delete", "Backspace"].includes(event.key) &&
          selection.any() &&
          props.onDelete
        ) {
          event.preventDefault();
          const held = props.identity;
          void Promise.resolve(props.onDelete()).finally(() => {
            if (alive && props.identity === held) list.focus();
          });
        } else if (event.key === "Enter" && selected && selection.any() && props.onActivate) {
          event.preventDefault();
          props.onActivate(selected);
        }
      }}
    >
      <For each={props.items}>
        {(item, index) => (
          <li
            id={`${id}-${index()}`}
            role="option"
            data-object-item={item}
            classList={{
              "list-drag-source": drag.dragged() === item,
              "list-drop-before": drag.edge(item) === "before",
              "list-drop-after": drag.edge(item) === "after",
            }}
            aria-selected={selection.contains(item)}
            title={props.itemLabel?.(item) ?? item}
            draggable={false}
            onClick={(event) => {
              if (!props.disabled) {
                selection.click(item, event);
                list.focus();
              }
            }}
            onDblClick={() => {
              if (!props.disabled) props.onActivate?.(item);
            }}
          >
            <Show when={props.onReorder || props.onDragStart}>
              <span
                class="object-list-grip"
                aria-hidden="true"
                draggable={!props.disabled}
                onDragStart={(event) => {
                  const row = event.currentTarget.closest<HTMLLIElement>("li");
                  if (props.disabled || !row) {
                    event.preventDefault();
                    return;
                  }
                  drag.nativeStart(event, item, row);
                  event.dataTransfer?.setData("text/plain", item);
                  if (event.dataTransfer)
                    event.dataTransfer.effectAllowed = props.onReorder
                      ? props.onDragStart
                        ? "copyMove"
                        : "move"
                      : "copy";
                }}
                onDragEnd={drag.cancel}
                onPointerDown={(event) => drag.pointerDown(event, item)}
                onPointerMove={drag.pointerMove}
                onPointerUp={drag.pointerUp}
                onPointerCancel={drag.cancel}
                onLostPointerCapture={drag.cancel}
              >
                ⋮⋮
              </span>
            </Show>
            <span class="object-list-label">
              {props.render ? props.render(item) : (props.itemLabel?.(item) ?? item)}
            </span>
          </li>
        )}
      </For>
      <Show when={!props.items.length}>
        <li role="presentation" class="object-list-empty muted">
          <span>{props.empty}</span>
        </li>
      </Show>
    </ul>
  );
}

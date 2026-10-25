import { batch, createEffect, createMemo, createSignal, on } from "solid-js";
import { objectListStep } from "../library/object-list";
interface Modifiers {
  shiftKey?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
}
interface SelectionProps {
  items: readonly string[];
  selected: string | undefined;
  selectedItems?: readonly string[] | undefined;
  onSelect: (id: string) => void;
  onSelectMany?: ((ids: readonly string[]) => void) | undefined;
  identity?: unknown;
  disabled?: boolean | undefined;
}
/** Focus and range anchor belong to one list owner; selected rows remain controlled by its caller. */
export function createObjectListSelection(props: SelectionProps) {
  const [state, setState] = createSignal<{ identity: unknown; active: string; anchor: string }>();
  createEffect(
    on(
      () => props.identity,
      () => setState(undefined),
    ),
  );
  const selected = createMemo(() => {
    const admitted = new Set(props.items);
    return new Set(
      (props.selectedItems ?? (props.selected ? [props.selected] : [])).filter((id) =>
        admitted.has(id),
      ),
    );
  });
  const held = () => (state()?.identity === props.identity ? state() : undefined);
  const active = () => {
    const focused = held()?.active;
    return focused && props.items.includes(focused)
      ? focused
      : props.selected && props.items.includes(props.selected)
        ? props.selected
        : selected().values().next().value;
  };
  const click = (id: string, modifiers: Modifiers) => {
    if (props.disabled || !props.items.includes(id)) return;
    const additive = modifiers.ctrlKey || modifiers.metaKey;
    const previous = held()?.anchor;
    const anchor =
      modifiers.shiftKey && props.onSelectMany
        ? previous && props.items.includes(previous)
          ? previous
          : (active() ?? id)
        : id;
    batch(() => {
      setState({ identity: props.identity, active: id, anchor });
      if (modifiers.shiftKey && props.onSelectMany) {
        const start = props.items.indexOf(anchor),
          end = props.items.indexOf(id);
        const range = new Set(props.items.slice(Math.min(start, end), Math.max(start, end) + 1));
        props.onSelectMany(
          props.items.filter((item) => range.has(item) || (additive && selected().has(item))),
        );
      } else if (additive && props.onSelectMany) {
        const next = new Set(selected());
        if (next.has(id)) next.delete(id);
        else next.add(id);
        props.onSelectMany(props.items.filter((item) => next.has(item)));
      } else props.onSelect(id);
    });
  };
  return {
    active,
    contains: (id: string) => selected().has(id),
    any: () => selected().size > 0,
    click,
    move: (key: string, modifiers: Modifiers) => {
      const next = objectListStep(props.items, active(), key);
      if (next !== undefined) click(next, modifiers);
    },
    all: () => {
      if (props.disabled || !props.onSelectMany) return false;
      const first = props.items[0],
        focused = active() ?? first;
      batch(() => {
        if (first && focused)
          setState({ identity: props.identity, active: focused, anchor: first });
        props.onSelectMany!(props.items);
      });
      return true;
    },
  };
}

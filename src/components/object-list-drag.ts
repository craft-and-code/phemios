import { createSignal } from "solid-js";
import { createListDrag } from "./list-drag";
import { listInsertion, movesListItem, type ListInsertion } from "./list-insertion";
interface DragProps {
  items: readonly string[];
  identity?: unknown;
  disabled?: boolean | undefined;
  onReorder?: ((id: string, before?: string) => void | Promise<void>) | undefined;
  onDragStart?: ((id: string) => void) | undefined;
  onPointerOver?: ((hit: Element | null, y: number) => void) | undefined;
  onPointerDrop?: ((hit: Element | null, y: number) => void) | undefined;
  onDragEnd?: (() => void) | undefined;
}
/** Only actual reorder destinations receive a cue; collection copies delegate to their menu destination. */
export function createObjectListDrag(
  props: DragProps,
  list: () => HTMLUListElement,
  select: (id: string) => void,
) {
  const [target, setTarget] = createSignal<ListInsertion>();
  const destination = (key: string, hit: Element | null, y: number) => {
    const position = listInsertion(list(), "data-object-item", props.items, hit, y);
    return position && movesListItem(props.items, key, position.before) ? position : undefined;
  };
  const drag = createListDrag({
    identity: () => props.identity,
    enabled: () => !props.disabled && !!(props.onReorder || props.onDragStart),
    contains: (key) => props.items.includes(key),
    start: (key) => {
      select(key);
      props.onDragStart?.(key);
    },
    end: () => {
      setTarget(undefined);
      props.onDragEnd?.();
    },
    over: (hit, y) => {
      const key = drag.dragged();
      setTarget(key && props.onReorder ? destination(key, hit, y) : undefined);
      props.onPointerOver?.(hit, y);
    },
    drop: (key, hit, y) => {
      if (props.onReorder && hit && (hit === list() || list().contains(hit))) {
        const position = destination(key, hit, y);
        if (position) void props.onReorder(key, position.before);
      } else props.onPointerDrop?.(hit, y);
    },
  });
  return {
    ...drag,
    edge: (id: string) => (drag.dragged() && target()?.row === id ? target()?.edge : undefined),
    nativeLeave: (event: DragEvent) => {
      if (!event.relatedTarget || !list().contains(event.relatedTarget as Node))
        setTarget(undefined);
    },
  };
}

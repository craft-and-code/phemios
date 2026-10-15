import { createEffect, createSignal, onCleanup } from "solid-js";
import { moveQueueOccurrence, queueDropEdge } from "../library/queue-order";
type Pointer = PointerEvent & { currentTarget: HTMLButtonElement };
/** One bounded row preview follows the pointer; only a confirmed, current-scope drop edits the order. */
export function createQueueDrag(options: {
  enabled: () => boolean;
  order: () => readonly number[];
  id: () => number;
  onReorder: (order: number[], id: number, focus?: number) => void;
}) {
  const [dragged, setDragged] = createSignal<number>(),
    [target, setTarget] = createSignal<number>();
  let source:
      | {
          index: number;
          id: number;
          x: number;
          y: number;
          pointer?: number;
          grip?: HTMLButtonElement;
          row: HTMLLIElement;
        }
      | undefined,
    preview: HTMLDivElement | undefined,
    frame: number | undefined,
    latest = { x: 0, y: 0 };
  function cancel() {
    const grip = source?.grip,
      pointer = source?.pointer;
    source = undefined;
    if (grip && pointer !== undefined && grip.hasPointerCapture(pointer))
      grip.releasePointerCapture(pointer);
    if (frame !== undefined) cancelAnimationFrame(frame);
    frame = undefined;
    preview?.remove();
    preview = undefined;
    setDragged(undefined);
    setTarget(undefined);
  }
  function valid() {
    return (
      !!source &&
      options.enabled() &&
      source.id === options.id() &&
      options.order().includes(source.index)
    );
  }
  function image(row: HTMLLIElement) {
    const box = row.getBoundingClientRect(),
      wrapper = document.createElement("div"),
      aside = document.createElement("aside"),
      list = document.createElement("ol"),
      copy = row.cloneNode(true) as HTMLLIElement;
    wrapper.className = "playback-page queue-drag-preview";
    wrapper.style.width = `${box.width}px`;
    wrapper.setAttribute("aria-hidden", "true");
    wrapper.setAttribute("inert", "");
    aside.className = "playback-queue";
    copy.classList.remove(
      "queue-drop-target",
      "queue-drop-before",
      "queue-drop-after",
      "queue-drag-source",
    );
    copy.removeAttribute("data-queue-index");
    copy.draggable = false;
    for (const element of copy.querySelectorAll("[id], [tabindex], button, a")) {
      element.removeAttribute("id");
      element.setAttribute("tabindex", "-1");
    }
    list.append(copy);
    aside.append(list);
    wrapper.append(aside);
    document.body.append(wrapper);
    preview = wrapper;
    return { box, wrapper };
  }
  function position(x: number, y: number) {
    latest = { x, y };
    if (frame !== undefined) return;
    frame = requestAnimationFrame(() => {
      frame = undefined;
      if (source && preview)
        preview.style.transform = `translate3d(${latest.x - source.x}px, ${latest.y - source.y}px, 0)`;
    });
  }
  function drop() {
    const held = source,
      to = target();
    const accepted = valid() && to !== undefined && options.order().includes(to);
    cancel();
    if (accepted && held && to !== undefined && held.index !== to)
      options.onReorder(moveQueueOccurrence(options.order(), held.index, to), held.id);
  }
  createEffect(() => {
    options.id();
    options.order();
    options.enabled();
    if (source && !valid()) cancel();
  });
  const escape = (event: KeyboardEvent) => {
    if (source && event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      cancel();
    }
  };
  document.addEventListener("keydown", escape, true);
  window.addEventListener("blur", cancel);
  onCleanup(() => {
    cancel();
    document.removeEventListener("keydown", escape, true);
    window.removeEventListener("blur", cancel);
  });
  return {
    dragged,
    target,
    edge: (index: number) =>
      target() === index ? queueDropEdge(options.order(), dragged(), index) : undefined,
    cancel,
    pointerDown(event: Pointer, index: number) {
      if (event.button !== 0 || !options.enabled()) return;
      const row = event.currentTarget.closest<HTMLLIElement>("li[data-queue-index]");
      if (!row) return;
      event.preventDefault();
      cancel();
      source = {
        index,
        id: options.id(),
        x: event.clientX,
        y: event.clientY,
        pointer: event.pointerId,
        grip: event.currentTarget,
        row,
      };
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    pointerMove(event: Pointer) {
      if (!source || source.pointer !== event.pointerId) return;
      if (!valid()) {
        cancel();
        return;
      }
      if (dragged() === undefined) {
        if (Math.hypot(event.clientX - source.x, event.clientY - source.y) < 5) return;
        const { box } = image(source.row);
        source.x -= box.left;
        source.y -= box.top;
        setDragged(source.index);
      }
      position(event.clientX, event.clientY);
      const hit = document
        .elementFromPoint(event.clientX, event.clientY)
        ?.closest<HTMLLIElement>("li[data-queue-index]");
      const index =
        hit && source.row.parentElement?.contains(hit) ? Number(hit.dataset.queueIndex) : undefined;
      setTarget(index !== undefined && options.order().includes(index) ? index : undefined);
    },
    pointerUp(event: Pointer) {
      if (!source || source.pointer !== event.pointerId) return;
      event.preventDefault();
      drop();
    },
    nativeStart(event: DragEvent & { currentTarget: HTMLLIElement }, index: number) {
      if (!options.enabled() || source?.pointer !== undefined) {
        event.preventDefault();
        return;
      }
      cancel();
      source = {
        index,
        id: options.id(),
        x: event.clientX,
        y: event.clientY,
        row: event.currentTarget,
      };
      setDragged(index);
      if (event.dataTransfer) {
        const { box, wrapper } = image(event.currentTarget);
        wrapper.style.transform = "translate3d(-10000px, 0, 0)";
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", String(index));
        event.dataTransfer.setDragImage(wrapper, event.clientX - box.left, event.clientY - box.top);
      }
    },
    nativeOver(event: DragEvent, index: number) {
      if (valid()) {
        event.preventDefault();
        setTarget(index);
      }
    },
    nativeDrop(event: DragEvent, index: number) {
      event.preventDefault();
      setTarget(index);
      drop();
    },
    key(event: KeyboardEvent, index: number) {
      if (event.key === "Escape") {
        cancel();
        return;
      }
      if (!options.enabled() || !["ArrowUp", "ArrowDown"].includes(event.key)) return;
      event.preventDefault();
      const order = options.order(),
        neighbour = order[order.indexOf(index) + (event.key === "ArrowUp" ? -1 : 1)];
      if (neighbour !== undefined)
        options.onReorder(moveQueueOccurrence(order, index, neighbour), options.id(), index);
    },
  };
}
export type QueueDrag = ReturnType<typeof createQueueDrag>;

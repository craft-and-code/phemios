import { createEffect, createSignal, onCleanup } from "solid-js";
type Pointer = PointerEvent & { currentTarget: HTMLElement };
/** Same pointer threshold, fading and floating row as the playback queue, scoped to one list owner. */
export function createListDrag(options: {
  identity: () => unknown;
  enabled: () => boolean;
  contains: (key: string) => boolean;
  start: (key: string) => void;
  end: () => void;
  over?: ((hit: Element | null, y: number) => void) | undefined;
  drop: (key: string, hit: Element | null, y: number) => void;
}) {
  const [dragged, setDragged] = createSignal<string>();
  let held:
    | {
        key: string;
        identity: unknown;
        row: HTMLLIElement;
        grip?: HTMLElement;
        pointer?: number;
        x: number;
        y: number;
      }
    | undefined;
  let preview: HTMLDivElement | undefined,
    frame: number | undefined,
    latest = { x: 0, y: 0 };
  const valid = () =>
    !!held &&
    options.enabled() &&
    held.identity === options.identity() &&
    options.contains(held.key);
  function cancel() {
    const old = held;
    held = undefined;
    if (old?.pointer !== undefined && old.grip?.hasPointerCapture(old.pointer))
      old.grip.releasePointerCapture(old.pointer);
    if (frame !== undefined) cancelAnimationFrame(frame);
    frame = undefined;
    preview?.remove();
    preview = undefined;
    setDragged(undefined);
    options.end();
  }
  function image(row: HTMLLIElement) {
    const box = row.getBoundingClientRect(),
      wrapper = document.createElement("div"),
      list = row.parentElement!.cloneNode(false) as HTMLElement,
      copy = row.cloneNode(true) as HTMLLIElement;
    wrapper.className = "settings-card navigation-menu-editor list-drag-preview";
    wrapper.style.width = `${box.width}px`;
    wrapper.setAttribute("aria-hidden", "true");
    wrapper.setAttribute("inert", "");
    // The source list has a fixed frame; the ghost contains one row only.
    list.style.height = "auto";
    list.removeAttribute("id");
    list.removeAttribute("aria-activedescendant");
    copy.classList.remove("list-drag-source", "drop-target", "list-drop-before", "list-drop-after");
    for (const element of [copy, ...copy.querySelectorAll("*")]) {
      element.removeAttribute("id");
      element.removeAttribute("draggable");
      element.removeAttribute("data-menu-item");
      element.setAttribute("tabindex", "-1");
    }
    list.append(copy);
    wrapper.append(list);
    document.body.append(wrapper);
    preview = wrapper;
    return { box, wrapper };
  }
  function position(x: number, y: number) {
    latest = { x, y };
    if (frame !== undefined) return;
    frame = requestAnimationFrame(() => {
      frame = undefined;
      if (held && preview)
        preview.style.transform = `translate3d(${latest.x - held.x}px, ${latest.y - held.y}px, 0)`;
    });
  }
  createEffect(() => {
    dragged();
    options.identity();
    options.enabled();
    if (held && !valid()) cancel();
  });
  const escape = (event: KeyboardEvent) => {
    if (held && event.key === "Escape") {
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
    cancel,
    pointerDown(event: Pointer, key: string) {
      if (event.button !== 0 || !options.enabled() || !options.contains(key)) return;
      const row = event.currentTarget.closest<HTMLLIElement>("li");
      if (!row) return;
      cancel();
      event.preventDefault();
      held = {
        key,
        identity: options.identity(),
        row,
        grip: event.currentTarget,
        pointer: event.pointerId,
        x: event.clientX,
        y: event.clientY,
      };
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    pointerMove(event: Pointer) {
      if (!held || held.pointer !== event.pointerId) return;
      if (!valid()) {
        cancel();
        return;
      }
      if (dragged() === undefined) {
        if (Math.hypot(event.clientX - held.x, event.clientY - held.y) < 5) return;
        const { box } = image(held.row);
        held.x -= box.left;
        held.y -= box.top;
        setDragged(held.key);
        options.start(held.key);
      }
      position(event.clientX, event.clientY);
      options.over?.(document.elementFromPoint(event.clientX, event.clientY), event.clientY);
    },
    pointerUp(event: Pointer) {
      if (!held || held.pointer !== event.pointerId) return;
      const key = held.key,
        accepted = valid() && dragged() !== undefined,
        hit = document.elementFromPoint(event.clientX, event.clientY);
      // Drop admission runs before clearing the initiating owner/payload.
      try {
        if (accepted) {
          event.preventDefault();
          options.drop(key, hit, event.clientY);
        }
      } finally {
        cancel();
      }
    },
    nativeStart(event: DragEvent, key: string, row: HTMLLIElement) {
      if (held?.pointer !== undefined || !options.enabled() || !options.contains(key)) {
        event.preventDefault();
        return;
      }
      cancel();
      held = { key, identity: options.identity(), row, x: event.clientX, y: event.clientY };
      setDragged(key);
      options.start(key);
      if (event.dataTransfer) {
        const { box, wrapper } = image(row);
        wrapper.style.transform = "translate3d(-10000px,0,0)";
        event.dataTransfer.setDragImage(wrapper, event.clientX - box.left, event.clientY - box.top);
      }
    },
    nativeOver(event: DragEvent) {
      if (!valid()) {
        if (held) cancel();
        return;
      }
      event.preventDefault();
      options.over?.(event.target as Element | null, event.clientY);
    },
    nativeDrop(event: DragEvent) {
      try {
        if (valid()) {
          event.preventDefault();
          event.stopPropagation?.();
          options.drop(held!.key, event.target as Element | null, event.clientY);
        }
      } finally {
        cancel();
      }
    },
  };
}

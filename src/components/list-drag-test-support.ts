import { vi, type Mock } from "vitest";
/** Minimal DOM boundary for deterministic pointer lifecycle tests, without browser timing. */
export function dragFixture(): {
  body: { append: Mock };
  hit: Element;
  event: (
    x?: number,
    y?: number,
    pointerId?: number,
  ) => PointerEvent & { currentTarget: HTMLElement };
  listeners: Map<string, EventListener>;
  removed: Mock;
  paint: () => void;
} {
  const node = (): any => ({
    style: {},
    classList: { remove: vi.fn() },
    removeAttribute: vi.fn(),
    setAttribute: vi.fn(),
    querySelectorAll: () => [],
    append: vi.fn(),
    remove: vi.fn(),
    cloneNode: () => node(),
    getBoundingClientRect: () => ({ left: 10, top: 20, width: 300, height: 34 }),
  });
  const row = node();
  row.parentElement = node();
  let capture = false;
  const grip = {
    closest: () => row,
    setPointerCapture: () => {
      capture = true;
    },
    hasPointerCapture: () => capture,
    releasePointerCapture: () => {
      capture = false;
    },
  };
  const body = { append: vi.fn() },
    hit = node(),
    listeners = new Map<string, EventListener>(),
    removed = vi.fn();
  vi.stubGlobal("document", {
    createElement: () => node(),
    body,
    elementFromPoint: () => hit,
    addEventListener: (kind: string, fn: EventListener) => listeners.set(kind, fn),
    removeEventListener: removed,
  });
  vi.stubGlobal("window", {
    addEventListener: (kind: string, fn: EventListener) => listeners.set(kind, fn),
    removeEventListener: removed,
  });
  let paint: (() => void) | undefined;
  vi.stubGlobal("requestAnimationFrame", (fn: () => void) => {
    paint = fn;
    return 1;
  });
  vi.stubGlobal("cancelAnimationFrame", () => {
    paint = undefined;
  });
  const event = (x = 20, y = 25, pointerId = 1) =>
    ({
      button: 0,
      currentTarget: grip,
      clientX: x,
      clientY: y,
      pointerId,
      preventDefault: vi.fn(),
    }) as unknown as PointerEvent & { currentTarget: HTMLElement };
  return { body, hit, event, listeners, removed, paint: () => paint?.() };
}

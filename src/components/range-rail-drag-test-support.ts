import { createRoot } from "solid-js";
import { vi } from "vitest";
import type { Interval } from "../library/types";
import { createRangeRailDrag } from "./range-rail-drag";

/** Isolated event targets exercise document tracking without native pointer timing. */
export function rangeRailFixture(initial: Interval = [2, 4], bounds: Interval = [0, 26]) {
  const documentListeners = new Map<string, EventListener>();
  const windowListeners = new Map<string, EventListener>();
  const target = (listeners: Map<string, EventListener>) => ({
    addEventListener: vi.fn((kind: string, callback: EventListener) =>
      listeners.set(kind, callback),
    ),
    removeEventListener: vi.fn((kind: string) => listeners.delete(kind)),
  });
  const documentTarget = target(documentListeners),
    windowTarget = target(windowListeners);
  vi.stubGlobal("document", documentTarget);
  vi.stubGlobal("window", windowTarget);
  let captured = false,
    value: Interval = initial,
    domain: Interval = bounds,
    width = 260;
  const track = {
    getBoundingClientRect: () => ({ width }),
    setPointerCapture: vi.fn(() => {
      captured = true;
    }),
    hasPointerCapture: () => captured,
    releasePointerCapture: vi.fn(() => {
      captured = false;
    }),
  };
  const band = { focus: vi.fn<() => void>() };
  const change = vi.fn((next: Interval) => {
    value = next;
  });
  const root = createRoot((dispose) => ({
    dispose,
    drag: createRangeRailDrag({
      track: () => track as unknown as HTMLElement,
      value: () => value,
      domain: () => domain,
      change,
    }),
  }));
  const event = (x = 10, patch: Partial<PointerEvent> = {}) =>
    ({
      clientX: x,
      clientY: 10,
      pointerId: 1,
      button: 0,
      buttons: 1,
      isPrimary: true,
      currentTarget: band,
      preventDefault: vi.fn(),
      ...patch,
    }) as unknown as PointerEvent & { currentTarget: HTMLElement };
  return {
    ...root,
    band,
    track,
    change,
    documentListeners,
    windowListeners,
    event,
    value: () => value,
    width: (next: number) => {
      width = next;
    },
    domain: (next: Interval) => {
      domain = next;
    },
    replace: (next: Interval) => {
      value = next;
    },
    loseCapture: () => {
      captured = false;
    },
    send: (kind: string, input: Event) => documentListeners.get(kind)?.(input),
    pointer: (kind: string, x: number, patch: Partial<PointerEvent> = {}) =>
      documentListeners.get(kind)?.(event(x, patch)),
  };
}

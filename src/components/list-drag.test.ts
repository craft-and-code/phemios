import { createRoot, createSignal } from "solid-js";
import { afterEach, expect, it, vi } from "vitest";
import { createListDrag } from "./list-drag";
import { dragFixture } from "./list-drag-test-support";
afterEach(() => vi.unstubAllGlobals());
it.each(["owner", "disabled", "removed", "escape", "blur", "cancel", "dispose"])(
  "rejects a floating row drop after %s and clears its preview",
  (change) => {
    const dom = dragFixture();
    createRoot((dispose) => {
      const [identity, setIdentity] = createSignal({}),
        [enabled, setEnabled] = createSignal(true),
        [present, setPresent] = createSignal(true),
        drop = vi.fn();
      const drag = createListDrag({
        identity,
        enabled,
        contains: () => present(),
        start: vi.fn(),
        end: vi.fn(),
        drop,
      });
      drag.pointerDown(dom.event(), "one");
      drag.pointerMove(dom.event(60, 70));
      dom.paint();
      expect(drag.dragged()).toBe("one");
      const preview = dom.body.append.mock.calls[0]![0];
      expect(preview.style.transform).toBe("translate3d(50px, 65px, 0)");
      if (change === "owner") setIdentity({});
      if (change === "disabled") setEnabled(false);
      if (change === "removed") setPresent(false);
      if (change === "escape")
        dom.listeners.get("keydown")?.({
          key: "Escape",
          preventDefault: vi.fn(),
          stopPropagation: vi.fn(),
        } as unknown as Event);
      if (change === "blur") dom.listeners.get("blur")?.({} as Event);
      if (change === "cancel") drag.cancel();
      if (change === "dispose") dispose();
      drag.pointerUp(dom.event(60, 70));
      expect(drop).not.toHaveBeenCalled();
      expect(preview.remove).toHaveBeenCalled();
      expect(drag.dragged()).toBeUndefined();
      dispose();
      expect(dom.removed).toHaveBeenCalled();
    });
  },
);
it("ignores click-sized movement and foreign pointers, then admits exactly one current drop", () => {
  const dom = dragFixture();
  createRoot((dispose) => {
    const drop = vi.fn(),
      start = vi.fn(),
      identity = {};
    const drag = createListDrag({
      identity: () => identity,
      enabled: () => true,
      contains: (key) => key === "one",
      start,
      end: vi.fn(),
      drop,
    });
    drag.pointerDown(dom.event(), "one");
    drag.pointerMove(dom.event(22, 26));
    drag.pointerUp(dom.event(22, 26));
    expect(start).not.toHaveBeenCalled();
    expect(drop).not.toHaveBeenCalled();
    expect(dom.body.append).not.toHaveBeenCalled();
    drag.pointerDown(dom.event(), "one");
    drag.pointerMove(dom.event(60, 70, 2));
    expect(start).not.toHaveBeenCalled();
    drag.pointerMove(dom.event(60, 70));
    drag.pointerUp(dom.event(60, 70, 2));
    expect(drop).not.toHaveBeenCalled();
    drag.pointerUp(dom.event(60, 70));
    drag.pointerUp(dom.event(60, 70));
    expect(drop).toHaveBeenCalledExactlyOnceWith("one", dom.hit, 70);
    dispose();
  });
});

import { createRoot, createSignal } from "solid-js";
import { afterEach, expect, it, vi } from "vitest";
import { createObjectListDrag } from "./object-list-drag";
import { insertionFixture } from "./list-insertion-test-support";
import { dragFixture } from "./list-drag-test-support";
let dispose: () => void;
afterEach(() => {
  dispose?.();
  vi.unstubAllGlobals();
});
function fixture(copy = false, reorder = !copy) {
  const dom = dragFixture(),
    geometry = insertionFixture();
  let hit: Element | null = geometry.rows[1]!;
  document.elementFromPoint = () => hit;
  const [identity, setIdentity] = createSignal<unknown>({ owner: "first" });
  const [disabled, setDisabled] = createSignal(false);
  const move = vi.fn(),
    over = vi.fn(),
    drop = vi.fn();
  const drag = createRoot((end) => {
    dispose = end;
    return createObjectListDrag(
      {
        items: geometry.items,
        get identity() {
          return identity();
        },
        get disabled() {
          return disabled();
        },
        onReorder: reorder ? move : undefined,
        onDragStart: copy ? vi.fn() : undefined,
        onPointerOver: over,
        onPointerDrop: drop,
      },
      () => geometry.list as HTMLUListElement,
      vi.fn(),
    );
  });
  const native = (y: number, target: Element | null = hit) =>
    ({ clientX: 20, clientY: y, target, preventDefault: vi.fn() }) as unknown as DragEvent;
  const startNative = (key = "a") =>
    drag.nativeStart(native(110), key, dom.event().currentTarget.closest("li") as HTMLLIElement);
  return {
    drag,
    dom,
    ...geometry,
    move,
    over,
    drop,
    native,
    startNative,
    setIdentity,
    setDisabled,
    setHit: (next: Element | null) => {
      hit = next;
    },
  };
}
it("uses the same lower-half marker and destination for pointer and native release", () => {
  const { drag, dom, move, native, startNative } = fixture();
  drag.pointerDown(dom.event(), "a");
  drag.pointerMove(dom.event(50, 140));
  expect(drag.edge("c")).toBe("before");
  drag.pointerUp(dom.event(50, 140));
  expect(move).toHaveBeenLastCalledWith("a", "c");
  expect(drag.edge("c")).toBeUndefined();
  startNative();
  drag.nativeOver(native(140));
  expect(drag.edge("c")).toBe("before");
  drag.nativeDrop(native(140));
  expect(move.mock.calls).toEqual([
    ["a", "c"],
    ["a", "c"],
  ]);
  expect(drag.edge("c")).toBeUndefined();
});
it("shows a tail marker and appends when releasing in the list's empty lower area", () => {
  const { drag, dom, list, move, setHit } = fixture();
  setHit(list);
  drag.pointerDown(dom.event(), "a");
  drag.pointerMove(dom.event(50, 280));
  expect(drag.edge("c")).toBe("after");
  drag.pointerUp(dom.event(50, 280));
  expect(move).toHaveBeenCalledExactlyOnceWith("a", undefined);
});
it.each(["cancel", "owner", "disabled", "outside"])(
  "clears insertion feedback and rejects release after %s",
  (mode) => {
    const { drag, move, startNative, native, setIdentity, setDisabled } = fixture();
    startNative();
    drag.nativeOver(native(140));
    expect(drag.edge("c")).toBe("before");
    if (mode === "cancel") drag.cancel();
    if (mode === "owner") setIdentity({ owner: "successor" });
    if (mode === "disabled") setDisabled(true);
    if (mode === "outside") drag.nativeOver(native(140, null));
    expect(drag.edge("c")).toBeUndefined();
    drag.nativeDrop(native(140, null));
    expect(move).not.toHaveBeenCalled();
  },
);
it("forwards collection destination coordinates without advertising a drop into its read-only picker", () => {
  const { drag, over, drop, startNative, native, rows } = fixture(true);
  startNative();
  drag.nativeOver(native(140));
  expect(drag.edge("b")).toBeUndefined();
  expect(over).toHaveBeenLastCalledWith(rows[1], 140);
  drag.nativeDrop(native(140));
  expect(drop).toHaveBeenCalledExactlyOnceWith(rows[1], 140);
});
it("keeps one canonical cue while a collection switches from local reorder to menu copy", () => {
  const { drag, dom, move, over, drop, rows, setHit } = fixture(true, true);
  drag.pointerDown(dom.event(), "a");
  drag.pointerMove(dom.event(50, 140));
  expect([drag.edge("a"), drag.edge("b"), drag.edge("c")]).toEqual([
    undefined,
    undefined,
    "before",
  ]);
  const menu = {} as Element;
  setHit(menu);
  drag.pointerMove(dom.event(50, 190));
  expect([drag.edge("a"), drag.edge("b"), drag.edge("c")]).toEqual([
    undefined,
    undefined,
    undefined,
  ]);
  expect(over).toHaveBeenLastCalledWith(menu, 190);
  drag.pointerUp(dom.event(50, 190));
  expect(drop).toHaveBeenCalledExactlyOnceWith(menu, 190);
  expect(move).not.toHaveBeenCalled();
  setHit(rows[0]!);
  drag.pointerDown(dom.event(), "c");
  drag.pointerMove(dom.event(50, 101));
  expect(drag.edge("a")).toBe("before");
  drag.pointerUp(dom.event(50, 101));
  expect(move).toHaveBeenCalledExactlyOnceWith("c", "a");
  expect(drop).toHaveBeenCalledTimes(1);
});

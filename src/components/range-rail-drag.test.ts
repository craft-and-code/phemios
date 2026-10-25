import { afterEach, expect, it } from "vitest";
import { vi } from "vitest";
import { rangeRailFixture } from "./range-rail-drag-test-support";

afterEach(() => vi.unstubAllGlobals());

it("keeps a narrow alphabet interval moving diagonally after native capture is lost", () => {
  const f = rangeRailFixture();
  f.drag.start(f.event());
  expect(f.track.setPointerCapture).toHaveBeenCalledWith(1);
  expect(f.band.focus).toHaveBeenCalledWith({ preventScroll: true });
  f.loseCapture();
  f.pointer("pointermove", 110, { clientY: 900 });
  expect(f.value()).toEqual([12, 14]);
  expect(f.drag.dragging()).toBe(true);
  f.pointer("pointermove", 140, { clientY: -900 });
  expect(f.value()).toEqual([15, 17]);
  f.pointer("pointerup", 140, { buttons: 0 });
  expect(f.drag.dragging()).toBe(false);
  expect(f.documentListeners.size).toBe(0);
  f.dispose();
});

it("applies the final fast release outside the rail even without a preceding move", () => {
  const f = rangeRailFixture([2000, 2002], [1990, 2020]);
  f.drag.start(f.event());
  f.pointer("pointerup", 140, { clientY: -600, buttons: 0 });
  expect(f.value()).toEqual([2015, 2017]);
  expect(f.change).toHaveBeenCalledTimes(1);
  f.pointer("pointermove", 10);
  expect(f.value()).toEqual([2015, 2017]);
  f.dispose();
});

it("does not recompute catalog filters for unchanged rounded bounds or vertical movement", () => {
  const f = rangeRailFixture();
  f.drag.start(f.event());
  for (let y = 0; y < 100; y++) f.pointer("pointermove", 11, { clientY: y });
  expect(f.change).not.toHaveBeenCalled();
  for (let y = 0; y < 100; y++) f.pointer("pointermove", 40, { clientY: y });
  expect(f.change).toHaveBeenCalledExactlyOnceWith([5, 7]);
  f.dispose();
});

it("ignores foreign pointers and secondary-button release during an owned drag", () => {
  const f = rangeRailFixture();
  f.drag.start(f.event());
  f.drag.start(f.event(100, { pointerId: 2 }));
  for (const kind of ["pointermove", "pointerup", "pointercancel"])
    f.pointer(kind, 140, { pointerId: 2 });
  f.pointer("pointerup", 140, { button: 2 });
  expect(f.change).not.toHaveBeenCalled();
  expect(f.drag.dragging()).toBe(true);
  f.pointer("pointermove", 40);
  expect(f.value()).toEqual([5, 7]);
  f.dispose();
});

it.each(["pointercancel", "blur", "escape", "dispose", "released", "domain", "replacement"])(
  "stops tracking and removes every listener after %s",
  (reason) => {
    const f = rangeRailFixture();
    f.drag.start(f.event());
    f.pointer("pointermove", 40);
    if (reason === "pointercancel") f.pointer("pointercancel", 40);
    if (reason === "blur") f.windowListeners.get("blur")?.({} as Event);
    if (reason === "escape")
      f.send("keydown", {
        key: "Escape",
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
      } as unknown as Event);
    if (reason === "dispose") f.dispose();
    if (reason === "released") f.pointer("pointermove", 40, { buttons: 0 });
    if (reason === "domain") {
      f.domain([0, 30]);
      f.pointer("pointermove", 40);
    }
    if (reason === "replacement") {
      f.replace([10, 20]);
      f.pointer("pointermove", 40);
    }
    expect(f.drag.dragging()).toBe(false);
    expect(f.documentListeners.size).toBe(0);
    expect(f.windowListeners.size).toBe(0);
    expect(f.track.releasePointerCapture).toHaveBeenCalledTimes(1);
    f.pointer("pointermove", 150);
    expect(f.change).toHaveBeenCalledTimes(1);
    if (reason !== "dispose") f.dispose();
  },
);

it("retains the span at both edges and moves a single-letter selection", () => {
  const f = rangeRailFixture([3, 3]);
  f.drag.start(f.event());
  f.pointer("pointermove", 5000);
  expect(f.value()).toEqual([26, 26]);
  f.pointer("pointermove", -5000);
  expect(f.value()).toEqual([0, 0]);
  f.dispose();
});

it("uses document tracking when native capture is unavailable", () => {
  const f = rangeRailFixture();
  f.track.setPointerCapture.mockImplementation(() => {
    throw new Error("No native capture");
  });
  f.drag.start(f.event());
  f.pointer("pointerup", 60, { buttons: 0 });
  expect(f.value()).toEqual([7, 9]);
  expect(f.documentListeners.size).toBe(0);
  f.dispose();
});

it("does not admit nonprimary buttons, secondary touches or an unmeasurable track", () => {
  const f = rangeRailFixture();
  f.drag.start(f.event(10, { button: 2 }));
  f.drag.start(f.event(10, { isPrimary: false }));
  for (const width of [0, -1, Infinity, NaN]) {
    f.width(width);
    f.drag.start(f.event());
  }
  expect(f.drag.dragging()).toBe(false);
  expect(f.documentListeners.size).toBe(0);
  expect(f.band.focus).not.toHaveBeenCalled();
  f.dispose();
});

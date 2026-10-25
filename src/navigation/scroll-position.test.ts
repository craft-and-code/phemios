import { expect, it } from "vitest";
import { restorePosition, type ScrollPositionTarget } from "./scroll-position";

function viewport(maximum = 0) {
  const moves: number[] = [];
  let changed = () => {},
    interrupted = () => {},
    expired = () => {},
    cleaned = 0;
  const target: ScrollPositionTarget = {
    maximum: () => maximum,
    move: (top) => {
      moves.push(top);
    },
    changed: (fn) => {
      changed = fn;
      return () => {
        cleaned++;
      };
    },
    interrupted: (fn) => {
      interrupted = fn;
      return () => {
        cleaned++;
      };
    },
    expire: (fn) => {
      expired = fn;
      return () => {
        cleaned++;
      };
    },
  };
  return {
    target,
    moves,
    cleaned: () => cleaned,
    grow: (value: number) => {
      maximum = value;
      changed();
    },
    interrupt: () => interrupted(),
    expire: () => expired(),
  };
}

it("waits for asynchronous rows and restores the requested position when reachable", () => {
  const view = viewport();
  restorePosition(view.target, 1200);
  expect(view.moves).toEqual([0]);
  view.grow(600);
  expect(view.moves).toEqual([0, 600]);
  view.grow(1800);
  expect(view.moves).toEqual([0, 600, 1200]);
  expect(view.cleaned()).toBe(3);
  view.grow(2400);
  expect(view.moves).toEqual([0, 600, 1200]);
});

it("never pulls the viewport back after the user takes over", () => {
  const view = viewport(300);
  restorePosition(view.target, 1200);
  view.interrupt();
  view.grow(2000);
  expect(view.moves).toEqual([300]);
  expect(view.cleaned()).toBe(3);
});

it("retires unreachable restoration on expiry without a later jump", () => {
  const view = viewport(300);
  restorePosition(view.target, 1200);
  view.expire();
  view.grow(2000);
  expect(view.moves).toEqual([300]);
  expect(view.cleaned()).toBe(3);
});

it("cancels old navigation observers and makes repeated disposal harmless", () => {
  const view = viewport(300);
  const cancel = restorePosition(view.target, 1200);
  cancel();
  cancel();
  view.grow(2000);
  expect(view.moves).toEqual([300]);
  expect(view.cleaned()).toBe(3);
});

it("cleans observers immediately when the saved position already fits", () => {
  const view = viewport(1000);
  restorePosition(view.target, 500);
  expect(view.moves).toEqual([500]);
  expect(view.cleaned()).toBe(3);
});

it.each([-5, NaN, Infinity])("treats invalid saved positions as the top (%s)", (position) => {
  const view = viewport(500);
  restorePosition(view.target, position);
  expect(view.moves).toEqual([0]);
});

it("retires a subscription that reports a reachable position synchronously", () => {
  const moves: number[] = [];
  let cleaned = 0,
    extraSubscriptions = 0;
  restorePosition(
    {
      maximum: () => 100,
      move: (top) => {
        moves.push(top);
      },
      changed: (retry) => {
        retry();
        return () => {
          cleaned++;
        };
      },
      interrupted: () => {
        extraSubscriptions++;
        return () => {};
      },
      expire: () => {
        extraSubscriptions++;
        return () => {};
      },
    },
    50,
  );
  expect(moves).toEqual([50]);
  expect(cleaned).toBe(1);
  expect(extraSubscriptions).toBe(0);
});

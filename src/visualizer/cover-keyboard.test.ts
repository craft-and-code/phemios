import { expect, it, vi } from "vitest";
import { createCoverKeyboard } from "./cover-keyboard";
import { createCoverScrub } from "./cover-scrub";
import { defaultShortcuts, shortcutAction } from "../navigation/shortcuts-policy";
function key(name = "ArrowRight") {
  const event = {
    key: name,
    code: name,
    defaultPrevented: false,
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    shiftKey: false,
    repeat: false,
    preventDefault() {
      event.defaultPrevented = true;
    },
    currentTarget: { focus: vi.fn() },
  };
  return event;
}
it("keeps keyboard ownership on the stable region before the old focused card disappears", () => {
  const event = key();
  const choose = vi.fn(() => {
    expect(event.currentTarget.focus).toHaveBeenCalledExactlyOnceWith({ preventScroll: true });
  });
  const cancel = vi.fn();
  const navigate = createCoverKeyboard({ index: () => 6, total: () => 20, cancel, choose });
  navigate(event);
  expect(event.defaultPrevented).toBe(true);
  expect(cancel).toHaveBeenCalledOnce();
  expect(choose).toHaveBeenCalledExactlyOnceWith(7);
});
it("retires a pending slider target before keyboard movement can be overwritten", () => {
  let frame: (() => void) | undefined;
  const positions: number[] = [];
  const scrub = createCoverScrub(
    (index) => positions.push(index),
    (callback) => {
      frame = callback;
      return 1;
    },
    () => {
      frame = undefined;
    },
  );
  const navigate = createCoverKeyboard({
    index: () => 4,
    total: () => 20,
    cancel: scrub.cancel,
    choose: (index) => positions.push(index),
  });
  scrub.move(15);
  navigate(key("ArrowLeft"));
  frame?.();
  expect(positions).toEqual([3]);
  scrub.dispose();
});
it("leaves modified transport shortcuts, Tab and already-handled keys to their owner", () => {
  const choose = vi.fn(),
    cancel = vi.fn();
  const navigate = createCoverKeyboard({ index: () => 4, total: () => 20, cancel, choose });
  const transport = key();
  transport.ctrlKey = true;
  navigate(transport);
  expect(shortcutAction(transport, defaultShortcuts, false)).toBe("next");
  const tab = key("Tab");
  navigate(tab);
  expect(tab.defaultPrevented).toBe(false);
  const handled = key();
  handled.defaultPrevented = true;
  navigate(handled);
  expect(choose).not.toHaveBeenCalled();
  expect(cancel).not.toHaveBeenCalled();
});
it.each([
  ["ArrowLeft", 3],
  ["ArrowRight", 5],
  ["Home", 0],
  ["End", 19],
] as const)("moves %s to the expected catalogue position", (name, position) => {
  const choose = vi.fn();
  createCoverKeyboard({ index: () => 4, total: () => 20, cancel: vi.fn(), choose })(key(name));
  expect(choose).toHaveBeenCalledExactlyOnceWith(position);
});

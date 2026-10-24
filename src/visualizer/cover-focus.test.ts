import { createRoot, createSignal } from "solid-js";
import { expect, it, vi } from "vitest";
import { focusCoverOnMount } from "./cover-focus";
function region(editing = false, dialog = false, connected = true) {
  return {
    isConnected: connected,
    ownerDocument: {
      querySelector: () => (dialog ? {} : null),
      activeElement: { closest: () => (editing ? {} : null) },
    },
    focus: vi.fn(),
  };
}
it("focuses each newly displayed region once, after mounting, without tracking later changes", async () => {
  const element = region();
  let change!: (value: number) => number;
  const dispose = createRoot((dispose) => {
    const [read, write] = createSignal(0);
    change = write;
    element.focus.mockImplementation(() => {
      read();
    });
    focusCoverOnMount(element as unknown as HTMLElement);
    expect(element.focus).not.toHaveBeenCalled();
    return dispose;
  });
  await Promise.resolve();
  expect(element.focus).toHaveBeenCalledExactlyOnceWith({ preventScroll: true });
  change(1);
  await Promise.resolve();
  expect(element.focus).toHaveBeenCalledOnce();
  dispose();
});
it.each([
  [true, false, true],
  [false, true, true],
  [false, false, false],
])(
  "leaves editing=%s, modal=%s or disconnected regions alone",
  async (editing, dialog, connected) => {
    const element = region(editing, dialog, connected);
    const dispose = createRoot((dispose) => {
      focusCoverOnMount(element as unknown as HTMLElement);
      return dispose;
    });
    await Promise.resolve();
    expect(element.focus).not.toHaveBeenCalled();
    dispose();
  },
);
it("does not focus a region removed before its mount effect runs", async () => {
  const element = region();
  createRoot((dispose) => {
    focusCoverOnMount(element as unknown as HTMLElement);
    dispose();
  });
  await Promise.resolve();
  expect(element.focus).not.toHaveBeenCalled();
});

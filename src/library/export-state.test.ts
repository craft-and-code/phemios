import { createRoot, createSignal } from "solid-js";
import { expect, it } from "vitest";
import { createExportState } from "./export-state";
it("keeps the exported file with its original owner and clears it across an owner round trip", async () => {
  await createRoot(async (dispose) => {
    const alice = {},
      bob = {},
      [scope, setScope] = createSignal(alice);
    const state = createExportState<object, { id: string }>(scope);
    await Promise.resolve();
    const action = state.begin()!;
    action.file({ id: "Alice private export" });
    action.feedback("Alice path");
    action.finish();
    expect(state.file()?.id).toBe("Alice private export");
    setScope(bob);
    expect(state.file()).toBeUndefined();
    expect(state.message()).toBe("");
    setScope(alice);
    action.feedback("Alice late path");
    action.file({ id: "Late export" });
    expect(state.file()).toBeUndefined();
    expect(state.message()).toBe("");
    dispose();
  });
});
it("rejects an old target acknowledgement without clearing a newer transfer", () => {
  createRoot((dispose) => {
    const [scope, setScope] = createSignal("first file");
    const state = createExportState<string, string>(scope);
    const first = state.begin()!;
    expect(state.begin()).toBeUndefined();
    setScope("second file");
    const second = state.begin()!;
    first.feedback("old failure", true);
    first.finish();
    first.file("old file");
    expect(state.busy()).toBe(true);
    expect(state.message()).toBe("");
    second.file("new file");
    second.feedback("confirmed");
    second.finish();
    expect(state.file()).toBe("new file");
    expect(state.busy()).toBe(false);
    dispose();
    second.feedback("closed");
    expect(state.message()).toBe("");
  });
});
it("retains the same owner's file on retry and exposes only current failures", () => {
  createRoot((dispose) => {
    const state = createExportState<undefined, string>(() => undefined);
    const first = state.begin()!;
    first.file("saved");
    first.finish();
    const retry = state.begin()!;
    retry.feedback("disk full", true);
    retry.finish();
    expect(state.file()).toBe("saved");
    expect(state.failed()).toBe(true);
    state.dismiss();
    expect(state.message()).toBe("");
    expect(state.failed()).toBe(false);
    dispose();
  });
});

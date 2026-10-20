import { createRoot, createSignal } from "solid-js";
import { afterEach, expect, it, vi } from "vitest";
import { createServiceCancellation } from "./service-cancellation";
import type { AccountSession } from "./server";
const owner: AccountSession = {
  server: "https://music.example",
  account: { id: "a", username: "a", role: "admin" },
};
let dispose: () => void;
afterEach(() => dispose?.());
function setup() {
  return createRoot((end) => {
    dispose = end;
    const [session, setSession] = createSignal<AccountSession | undefined>(owner);
    const cancel = vi.fn(async () => {});
    const result = createServiceCancellation({ session: () => session(), cancel });
    return { result, cancel, setSession };
  });
}
it("removes an enrichment cancellation error on logout", async () => {
  const view = setup();
  view.cancel.mockRejectedValueOnce(new Error("Former cancellation error"));
  await view.result.cancel(7, "server");
  expect(view.result.error()).toContain("Former");
  view.setSession(undefined);
  expect(view.result.error()).toBe("");
});
it("ignores a late enrichment cancellation error after account replacement", async () => {
  const view = setup();
  let reject!: (error: Error) => void;
  view.cancel.mockImplementationOnce(
    () =>
      new Promise((_done, fail) => {
        reject = fail;
      }),
  );
  const pending = view.result.cancel(7, "server");
  view.setSession({ ...owner, account: { ...owner.account, id: "b" } });
  reject(new Error("Former account"));
  await pending;
  expect(view.result.error()).toBe("");
});

it("retains a current-session refusal and clears it on retry", async () => {
  const view = setup();
  view.cancel.mockRejectedValueOnce(new Error("Current refusal"));
  await view.result.cancel(7, "server");
  expect(view.result.error()).toContain("Current refusal");
  await view.result.cancel(7, "server");
  expect(view.result.error()).toBe("");
});
it("does not publish a cancellation failure after the settings view is disposed", async () => {
  const view = setup();
  let reject!: (error: Error) => void;
  view.cancel.mockImplementationOnce(
    () =>
      new Promise((_done, fail) => {
        reject = fail;
      }),
  );
  const pending = view.result.cancel(7, "server");
  dispose();
  reject(new Error("Disposed"));
  await pending;
  expect(view.result.error()).toBe("");
});

it("disables duplicate stop requests while waiting and resets admission on logout", async () => {
  const view = setup();
  let finish!: () => void;
  view.cancel.mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  const pending = view.result.cancel(7, "server");
  expect(view.result.pending()).toBe(true);
  await view.result.cancel(7, "server");
  expect(view.cancel).toHaveBeenCalledTimes(1);
  view.setSession(undefined);
  expect(view.result.pending()).toBe(false);
  finish();
  await pending;
  expect(view.result.pending()).toBe(false);
});
it("stops active enrichments on both sources without cancelling unrelated or completed jobs", async () => {
  const view = setup();
  await view.result.stopEnrichment([
    { task_id: 1, source: "local", kind: "fetch", status: "running" },
    { task_id: 2, source: "server", kind: "fetch", status: "queued" },
    { task_id: 3, source: "server", kind: "analyze", status: "running" },
    { task_id: 4, source: "local", kind: "fetch", status: "completed" },
  ]);
  expect(view.cancel.mock.calls).toEqual([
    [1, "local"],
    [2, "server"],
  ]);
});

it("keeps a new owner's pending stop when the old owner's request settles", async () => {
  const view = setup();
  let finishOld!: () => void, finishNew!: () => void;
  view.cancel.mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        finishOld = resolve;
      }),
  );
  const old = view.result.cancel(7, "server");
  view.setSession({ ...owner, account: { ...owner.account, id: "b" } });
  view.cancel.mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        finishNew = resolve;
      }),
  );
  const current = view.result.cancel(7, "server");
  finishOld();
  await old;
  expect(view.result.pending()).toBe(true);
  finishNew();
  await current;
  expect(view.result.pending()).toBe(false);
});
it("retains each refusal when stopping both independently owned enrichments", async () => {
  const view = setup();
  view.cancel
    .mockRejectedValueOnce(new Error("Local refusal"))
    .mockRejectedValueOnce(new Error("Server refusal"));
  await view.result.stopEnrichment([
    { task_id: 7, source: "local", kind: "fetch", status: "running" },
    { task_id: 7, source: "server", kind: "fetch", status: "running" },
  ]);
  expect(view.result.error()).toContain("Local refusal");
  expect(view.result.error()).toContain("Server refusal");
  view.setSession(undefined);
  expect(view.result.error()).toBe("");
});

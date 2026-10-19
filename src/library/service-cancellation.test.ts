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

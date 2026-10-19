import { createRoot, createSignal } from "solid-js";
import { afterEach, expect, it, vi } from "vitest";
import { createGenerationActions } from "./generation-actions";
import type { AccountSession } from "./server";
const account: AccountSession = {
  server: "https://music.example",
  account: { id: "a", username: "a", role: "admin" },
};
let dispose: () => void;
afterEach(() => dispose?.());
function setup() {
  return createRoot((end) => {
    dispose = end;
    const [owner, setOwner] = createSignal<AccountSession | undefined>(account);
    const start = vi.fn(async () => {}),
      cancel = vi.fn(async () => {});
    const actions = createGenerationActions({
      source: () => "server",
      session: () => owner(),
      active: () => ({ task_id: 7, source: "server", status: "running" }),
      start,
      cancel,
    });
    return { actions, setOwner, start, cancel };
  });
}
it("removes generation command diagnostics after logout", async () => {
  const view = setup();
  view.start.mockRejectedValueOnce(new Error("Former command failure"));
  await view.actions.start(["analyze"]);
  expect(view.actions.error()).toBe("Former command failure");
  view.setOwner(undefined);
  expect(view.actions.error()).toBe("");
});
for (const action of ["start", "cancel"] as const) {
  it(`ignores a late ${action} error after account replacement`, async () => {
    const view = setup();
    let reject!: (error: Error) => void;
    view[action].mockImplementationOnce(
      () =>
        new Promise((_resolve, fail) => {
          reject = fail;
        }),
    );
    const pending = action === "start" ? view.actions.start(["analyze"]) : view.actions.cancel();
    view.setOwner({ ...account, account: { ...account.account, id: "b" } });
    reject(new Error("Old account failure"));
    await pending;
    expect(view.actions.error()).toBe("");
  });
}

it("retains a current-owner failure and clears it on retry", async () => {
  const view = setup();
  view.cancel.mockRejectedValueOnce(new Error("Current failure"));
  await view.actions.cancel();
  expect(view.actions.error()).toBe("Current failure");
  await view.actions.cancel();
  expect(view.actions.error()).toBe("");
});
it("ignores a late failure after closing the settings view", async () => {
  const view = setup();
  let reject!: (error: Error) => void;
  view.start.mockImplementationOnce(
    () =>
      new Promise((_resolve, fail) => {
        reject = fail;
      }),
  );
  const pending = view.actions.start(["analyze"]);
  dispose();
  reject(new Error("Disposed failure"));
  await pending;
  expect(view.actions.error()).toBe("");
});
it("does not revive an old diagnostic when the same account object logs in again", async () => {
  const view = setup();
  view.cancel.mockRejectedValueOnce(new Error("Old failure"));
  await view.actions.cancel();
  view.setOwner(undefined);
  view.setOwner(account);
  expect(view.actions.error()).toBe("");
});

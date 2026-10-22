import { expect, it, vi } from "vitest";
import { changePasswordForSession } from "./account-password";
import type { AccountSession } from "./server";
const alice: AccountSession = {
  server: "https://music.example",
  nativeSession: "alice-first-login",
  account: { id: "alice", username: "alice", role: "admin" },
};
it.each(["logout", "replace", "same-account-relogin"])(
  "does not disconnect a successor after a password acknowledgement overtaken by %s",
  async (transition) => {
    let current: AccountSession | undefined = alice;
    let finish!: () => void;
    const change = vi.fn(async () => new Promise<void>((resolve) => (finish = resolve)));
    const disconnect = vi.fn(async () => {});
    const pending = changePasswordForSession({ session: () => current, change, disconnect });
    expect(change).toHaveBeenCalledWith(alice);
    // Native work may already have succeeded before its acknowledgement is handled by this view.
    finish();
    current =
      transition === "logout"
        ? undefined
        : {
            ...alice,
            nativeSession: "replacement-login",
            account: { ...alice.account, id: transition === "replace" ? "bob" : "alice" },
          };
    expect(await pending).toBe(false);
    expect(disconnect).not.toHaveBeenCalled();
  },
);
it("disconnects the unchanged login after success, but never after refusal", async () => {
  const disconnect = vi.fn(async () => {});
  const change = vi.fn(async () => {});
  expect(await changePasswordForSession({ session: () => alice, change, disconnect })).toBe(true);
  expect(disconnect).toHaveBeenCalledOnce();
  change.mockRejectedValueOnce(new Error("Password refused"));
  await expect(
    changePasswordForSession({ session: () => alice, change, disconnect }),
  ).rejects.toThrow("Password refused");
  expect(disconnect).toHaveBeenCalledOnce();
});
it("does not submit a password change without a captured login", async () => {
  const change = vi.fn(),
    disconnect = vi.fn();
  expect(await changePasswordForSession({ session: () => undefined, change, disconnect })).toBe(
    false,
  );
  expect(change).not.toHaveBeenCalled();
  expect(disconnect).not.toHaveBeenCalled();
});

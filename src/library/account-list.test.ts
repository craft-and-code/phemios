import { createRoot, createSignal } from "solid-js";
import { expect, it, vi, afterEach } from "vitest";
import { requestAede } from "../platform/desktop";
import { createAccountList, managedLocalAccount, parseAccounts } from "./account-list";
import type { AccountSession } from "./server";
vi.mock("../platform/desktop", () => ({ requestAede: vi.fn() }));
afterEach(() => vi.resetAllMocks());
it("refuses invalid roles, duplicate identities and malformed account flags", () => {
  const row = { id: "one", username: "one", role: "admin", enabled: true };
  expect(parseAccounts([row])).toEqual([row]);
  expect(() => parseAccounts([row, row])).toThrow();
  expect(() => parseAccounts([{ ...row, enabled: "yes" }])).toThrow();
  expect(() => parseAccounts([{ ...row, role: "owner" }])).toThrow();
});
it("confines failures to the accounts tab and never shows a late answer to a replaced account", async () => {
  let finish!: (raw: unknown) => void;
  const session: AccountSession = {
    server: "http://localhost:3412",
    account: { id: "one", username: "one", role: "admin" },
  };
  const [owner, setOwner] = createSignal<AccountSession | undefined>(session);
  vi.mocked(requestAede).mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  let dispose!: () => void;
  const rows = createRoot((end) => {
    dispose = end;
    return createAccountList(owner, () => "server");
  });
  for (let i = 0; i < 8; i++) await Promise.resolve();
  setOwner(undefined);
  finish([{ id: "one", username: "one", role: "admin", enabled: true }]);
  for (let i = 0; i < 8; i++) await Promise.resolve();
  expect(rows.values()).toEqual([]);
  vi.mocked(requestAede).mockRejectedValue(new Error("Unreadable accounts"));
  setOwner(session);
  for (let i = 0; i < 8; i++) await Promise.resolve();
  expect(rows.error()).toContain("Unreadable");
  expect(() => rows.values()).not.toThrow();
  dispose();
});

it("protects the managed local account without blocking a remote namesake", () => {
  expect(managedLocalAccount({ username: "phemios-local" }, "local")).toBe(true);
  expect(managedLocalAccount({ username: "phemios-local" }, "server")).toBe(false);
  expect(managedLocalAccount({ username: "PHEMIOS-LOCAL" }, "local")).toBe(true);
  expect(managedLocalAccount({ username: "phemios-local-child" }, "local")).toBe(false);
});

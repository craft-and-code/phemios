import { accountSettingKeys } from "./account-preference-keys";
import { createRoot } from "solid-js";
import { expect, it, vi } from "vitest";
import type { AccountSession } from "./server";
import type { SourceId } from "./sources";
import { createApplicationBackupTransfer } from "./application-backup-transfer";
import type { PersonalBackup } from "./application-backup";
import { exportApplicationBackup } from "./application-backup";
import { backupStorageFixture, personalBackupFixture } from "./application-backup-test-fixtures";
function setup() {
  let owner: AccountSession | undefined = {
      nativeSession: "one",
      server: "https://fixture.example",
      account: { id: "alice", username: "Alice", role: "user" },
    },
    source: SourceId = "server";
  const storage = backupStorageFixture(),
    identity = {},
    readPersonal = vi.fn(async (_source: SourceId, _owner: AccountSession): Promise<unknown> =>
      personalBackupFixture(),
    ),
    restorePersonal = vi.fn(
      async (_payload: PersonalBackup, _source: SourceId, _owner: AccountSession) => {},
    ),
    exported = vi.fn(
      async (_raw: string, _source?: SourceId, _owner?: AccountSession) => "/fictional/backup.json",
    ),
    preferencesApplied = vi.fn(),
    personalRestored = vi.fn();
  const transfer = createRoot(() =>
    createApplicationBackupTransfer({
      identity: () => identity,
      session: () => owner,
      source: () => source,
      storage,
      readPersonal,
      restorePersonal,
      export: exported,
      import: async () => exportApplicationBackup(storage, personalBackupFixture()),
      preferencesApplied,
      personalRestored,
    }),
  );
  return {
    transfer,
    storage,
    readPersonal,
    restorePersonal,
    exported,
    preferencesApplied,
    personalRestored,
    owner: () => owner,
    replace: () => {
      owner = {
        nativeSession: "two",
        server: "https://fixture.example",
        account: { id: "bob", username: "Bob", role: "user" },
      };
    },
    relogin: () => {
      owner = { ...owner!, nativeSession: "new-ticket" };
    },
    source: () => {
      source = source === "local" ? "server" : "local";
    },
    logout: () => {
      owner = undefined;
    },
    auditor: () => {
      owner = { ...owner!, account: { ...owner!.account, role: "auditor" } };
    },
  };
}
it("exports current private records with the captured native account and keeps anonymous exports v1", async () => {
  const view = setup();
  await view.transfer.run(true);
  expect(view.readPersonal).toHaveBeenCalledExactlyOnceWith("server", view.owner());
  expect(JSON.parse(view.exported.mock.calls[0]![0]!).personal).toEqual(personalBackupFixture());
  expect(view.exported.mock.calls[0]?.[1]).toBe("server");
  expect(view.exported.mock.calls[0]?.[2]).toBe(view.owner());
  view.logout();
  view.transfer.changed();
  await view.transfer.run(true);
  expect(JSON.parse(view.exported.mock.calls[1]![0]!).version).toBe(1);
  view.transfer.dispose();
});
it("refuses unreadable native data instead of exporting empty substitutes", async () => {
  const view = setup();
  view.readPersonal.mockRejectedValueOnce(new Error("Private data unreadable"));
  await view.transfer.run(true);
  expect(view.exported).not.toHaveBeenCalled();
  expect(view.transfer.error()).toContain("unreadable");
  view.transfer.dispose();
});
it.each(["replace", "relogin", "source"] as const)(
  "does not publish a late private read after %s",
  async (change) => {
    const view = setup();
    let finish!: (value: unknown) => void;
    view.readPersonal.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const exportWork = view.transfer.run(true);
    view[change]();
    finish(personalBackupFixture());
    await exportWork;
    expect(view.exported).not.toHaveBeenCalled();
    view.transfer.dispose();
  },
);
it("drops a reviewed private import after source/session replacement even without a preference-profile event", async () => {
  const view = setup();
  await view.transfer.run(false);
  expect(view.transfer.pending()?.personal).toBeDefined();
  view.source();
  view.transfer.changed();
  expect(view.transfer.pending()).toBeUndefined();
  await view.transfer.apply();
  expect(view.restorePersonal).not.toHaveBeenCalled();
  view.transfer.dispose();
});
it("guards preferences and acknowledgement after an asynchronous private restore changes owner", async () => {
  const view = setup();
  let finish!: () => void;
  view.restorePersonal.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  await view.transfer.run(false);
  const held = view.owner(),
    restore = view.transfer.apply();
  expect(view.restorePersonal.mock.calls[0]?.[2]).toBe(held);
  view.replace();
  finish();
  await restore;
  expect([...view.storage.values]).toEqual([]);
  expect(view.preferencesApplied).not.toHaveBeenCalled();
  expect(view.personalRestored).not.toHaveBeenCalled();
  expect(view.transfer.message()).toBe("");
  view.transfer.dispose();
});
it("keeps the review after failed restore and applies preferences only after successful explicit retry", async () => {
  const view = setup();
  view.restorePersonal.mockRejectedValueOnce(new Error("Unreadable destination"));
  await view.transfer.run(false);
  await view.transfer.apply();
  expect([...view.storage.values]).toEqual([]);
  expect(view.transfer.pending()).toBeDefined();
  expect(view.preferencesApplied).not.toHaveBeenCalled();
  await view.transfer.apply();
  expect(view.personalRestored).toHaveBeenCalledTimes(1);
  expect(view.preferencesApplied).toHaveBeenCalledTimes(1);
  expect([...view.storage.values.keys()].sort()).toEqual([...accountSettingKeys].sort());
  view.transfer.dispose();
});
it.each(["logout", "auditor"] as const)("never restores personal data while %s", async (change) => {
  const view = setup();
  view[change]();
  await view.transfer.run(false);
  await view.transfer.apply();
  expect(view.restorePersonal).not.toHaveBeenCalled();
  expect(view.storage.values.size).toBe(0);
  view.transfer.dispose();
});

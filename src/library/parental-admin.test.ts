import { createRoot, createSignal } from "solid-js";
import { expect, it, vi } from "vitest";
import { createParentalAdmin, type ParentalAdminScope } from "./parental-admin";
import { parentalScope, parentalSnapshot, settleParental } from "./parental-test-fixtures";
const deferred = () => {
  let resolve!: (value: unknown) => void;
  const promise = new Promise<unknown>((done) => {
    resolve = done;
  });
  return { promise, resolve };
};
it("saves only an explicitly edited policy with the captured owner, source and optimistic revision", async () => {
  const held = parentalScope(),
    request = vi
      .fn()
      .mockResolvedValueOnce(parentalSnapshot())
      .mockResolvedValueOnce({
        ...parentalSnapshot("child", 1),
        policy: { ...parentalSnapshot().policy, enabled: true },
      });
  let dispose!: () => void;
  const admin = createRoot((end) => {
    dispose = end;
    return createParentalAdmin(() => held, request);
  });
  try {
    await settleParental();
    expect(request).toHaveBeenCalledExactlyOnceWith(
      "/api/admin/v1/accounts/child/parental",
      {},
      "GET",
      null,
      "server",
      held.session,
    );
    expect(admin.dirty()).toBe(false);
    expect(await admin.save()).toBe(false);
    admin.update({ ...admin.draft()!, enabled: true });
    expect(admin.dirty()).toBe(true);
    expect(await admin.save()).toBe(true);
    expect(request).toHaveBeenLastCalledWith(
      "/api/admin/v1/accounts/child/parental",
      {},
      "PUT",
      { expected_owner: "child", expected_revision: 0, policy: admin.draft() },
      "server",
      held.session,
    );
    expect(admin.dirty()).toBe(false);
    expect(admin.message()).toContain("enregistré");
  } finally {
    dispose();
  }
});
it("preserves the unsaved draft on conflicts and never replays the write automatically", async () => {
  const request = vi
    .fn()
    .mockResolvedValueOnce(parentalSnapshot())
    .mockRejectedValueOnce(Error("409 conflict"));
  let dispose!: () => void;
  const admin = createRoot((end) => {
    dispose = end;
    return createParentalAdmin(parentalScope, request);
  });
  try {
    await settleParental();
    admin.update({ ...admin.draft()!, radio_allowed: false });
    expect(await admin.save()).toBe(false);
    expect(admin.error()).toContain("409");
    expect(admin.draft()?.radio_allowed).toBe(false);
    expect(admin.dirty()).toBe(true);
    expect(request).toHaveBeenCalledTimes(2);
    admin.reset();
    expect(admin.dirty()).toBe(false);
  } finally {
    dispose();
  }
});
it("retires drafts and late reads/writes when source, session or target changes", async () => {
  for (const phase of ["read", "write"] as const) {
    const first = parentalScope(),
      pending = deferred(),
      [scope, setScope] = createSignal<ParentalAdminScope | undefined>(first);
    const request = vi.fn().mockResolvedValue(parentalSnapshot());
    if (phase === "read") request.mockReturnValueOnce(pending.promise);
    let dispose!: () => void;
    const admin = createRoot((end) => {
      dispose = end;
      return createParentalAdmin(scope, request);
    });
    try {
      await settleParental();
      let saving: Promise<boolean> | undefined;
      if (phase === "write") {
        admin.update({ ...admin.draft()!, enabled: true });
        request.mockReturnValueOnce(pending.promise);
        saving = admin.save();
      }
      setScope(undefined);
      expect(admin.draft()).toBeUndefined();
      pending.resolve({
        ...parentalSnapshot("child", 1),
        policy: { ...parentalSnapshot().policy, enabled: true },
      });
      await saving;
      await settleParental();
      expect(admin.draft()).toBeUndefined();
      expect(admin.message()).toBe("");
      expect(admin.error()).toBe("");
      const next = {
        ...first,
        source: "local" as const,
        session: { ...first.session },
        target: { ...first.target, id: "next", username: "renamed" },
      };
      request.mockResolvedValue(parentalSnapshot("next"));
      setScope(next);
      await settleParental();
      expect(admin.draft()?.enabled).toBe(false);
      expect(request).toHaveBeenLastCalledWith(
        "/api/admin/v1/accounts/renamed/parental",
        {},
        "GET",
        null,
        "local",
        next.session,
      );
    } finally {
      dispose();
    }
  }
});
it("refuses non-administrators and administrator targets without dispatch", async () => {
  const base = parentalScope();
  for (const held of [
    { ...base, target: { ...base.target, role: "admin" as const } },
    { ...base, session: { ...base.session, account: { ...base.session.account, role: "user" } } },
  ]) {
    const request = vi.fn();
    let dispose!: () => void;
    const admin = createRoot((end) => {
      dispose = end;
      return createParentalAdmin(() => held, request);
    });
    await settleParental();
    expect(admin.draft()).toBeUndefined();
    expect(await admin.save()).toBe(false);
    expect(request).not.toHaveBeenCalled();
    dispose();
  }
});
it("refuses responses for another target and never publishes after disposal", async () => {
  const pending = deferred(),
    request = vi
      .fn()
      .mockResolvedValueOnce(parentalSnapshot("wrong"))
      .mockReturnValueOnce(pending.promise);
  let dispose!: () => void;
  const admin = createRoot((end) => {
    dispose = end;
    return createParentalAdmin(parentalScope, request);
  });
  await settleParental();
  expect(admin.error()).toContain("invalide");
  expect(admin.draft()).toBeUndefined();
  const loading = admin.load();
  dispose();
  pending.resolve(parentalSnapshot());
  await loading;
  expect(admin.draft()).toBeUndefined();
});

it("admits an HTTPS administrator but keeps another administrator's lock read-only", async () => {
  const held = parentalScope();
  held.session = { ...held.session, server: "https://fixture.invalid" };
  const request = vi.fn().mockResolvedValue({ ...parentalSnapshot(), locked_by: "another-admin" });
  let dispose!: () => void;
  const admin = createRoot((end) => {
    dispose = end;
    return createParentalAdmin(() => held, request);
  });
  try {
    await settleParental();
    expect(admin.draft()).toBeDefined();
    expect(admin.locked()).toBe(true);
    admin.update({ ...admin.draft()!, enabled: true });
    expect(admin.dirty()).toBe(false);
    expect(await admin.save()).toBe(false);
    expect(request).toHaveBeenCalledTimes(1);
  } finally {
    dispose();
  }
});

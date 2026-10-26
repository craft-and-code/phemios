import { expect, it, vi } from "vitest";
import { mountLibrary, disposeLibrary } from "./context-test-fixtures";
import {
  loginAede,
  startLocal,
  syncAede,
  restoreAedeSession,
  requestAede,
  setRequestSource,
  logoutAede,
  stopLocal,
} from "../platform/desktop";
vi.mock("../platform/desktop", async () => {
  const { mockLibraryDesktop } = await import("./context-desktop-test-fixtures");
  return mockLibraryDesktop();
});

it.each([
  ["server", "logout"],
  ["server", "dispose"],
  ["server", "continue"],
  ["local", "logout"],
  ["local", "dispose"],
  ["local", "continue"],
] as const)(
  "admits %s catalogue synchronization only while preparation remains current (%s)",
  async (source, retirement) => {
    const library = mountLibrary();
    expect(library).toBeDefined();
    if (source === "server")
      await library.connect("https://fixture.example", "fixture-admin", "fixture");
    else await library.enableLocal();
    expect(syncAede).toHaveBeenCalledTimes(1);
    vi.mocked(syncAede).mockClear();
    let finish!: () => void;
    vi.spyOn(library.parental, "refresh").mockReturnValueOnce(
      new Promise<undefined>((resolve) => {
        finish = () => resolve(undefined);
      }),
    );
    const pending = library.sync(source);
    try {
      expect(library.busy()).toBe(true);
      if (retirement === "dispose") disposeLibrary();
      else if (retirement === "logout") {
        if (source === "server") await library.disconnect();
        else await library.disableLocal();
      }
      finish();
      await pending;
      expect(syncAede).toHaveBeenCalledTimes(retirement === "continue" ? 1 : 0);
      if (retirement !== "dispose") {
        expect(library.busy()).toBe(false);
        vi.mocked(syncAede).mockClear();
        if (retirement === "logout") {
          if (source === "server")
            await library.connect("https://fixture.example", "fixture-admin", "fixture");
          else await library.enableLocal();
        } else await library.sync(source);
        expect(syncAede).toHaveBeenCalledExactlyOnceWith(source);
        expect(library.busy()).toBe(false);
      }
    } finally {
      finish();
      await pending;
    }
  },
);

it.each(["accepted", "conflict"] as const)(
  "does not resume login stages after provider disposal (%s)",
  async (outcome) => {
    const library = mountLibrary();
    const owner = {
      nativeSession: "late-login-session",
      server: "https://fixture.example",
      account: { id: "fixture-admin", username: "fixture-admin", role: "admin" },
    };
    let finish!: () => void;
    vi.mocked(loginAede).mockImplementationOnce(
      () =>
        new Promise((resolve, reject) => {
          finish = () =>
            outcome === "accepted"
              ? resolve(owner)
              : reject(new Error("Déconnectez la session active avant de changer de compte."));
        }),
    );
    vi.mocked(restoreAedeSession).mockResolvedValue(owner);
    const pending = library.connect(owner.server, owner.account.username, "fixture");
    disposeLibrary();
    expect(vi.getTimerCount()).toBe(0);
    finish();
    await pending;
    expect(vi.getTimerCount()).toBe(0);
    expect(library.serverSession()).toBeUndefined();
    expect(library.connected()).toBe(false);
    expect(restoreAedeSession).not.toHaveBeenCalled();
    expect(syncAede).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(45000);
    expect(requestAede).not.toHaveBeenCalled();
  },
);
it("does not publish a late local login or change routing after provider disposal", async () => {
  const library = mountLibrary();
  let finish!: () => void;
  vi.mocked(startLocal).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = () =>
          resolve({
            nativeSession: "late-local-session",
            server: "https://fixture.example",
            account: { id: "fixture-admin", username: "fixture-admin", role: "admin" },
          });
      }),
  );
  const pending = library.enableLocal();
  disposeLibrary();
  vi.mocked(setRequestSource).mockClear();
  finish();
  await pending;
  expect(setRequestSource).not.toHaveBeenCalled();
  expect(library.localSession()).toBeUndefined();
  expect(syncAede).not.toHaveBeenCalled();
  expect(vi.getTimerCount()).toBe(0);
});

it("does not start replacement authentication after disposed logout preparation", async () => {
  const library = mountLibrary();
  await library.connect("https://fixture.example", "fixture-admin", "fixture");
  vi.mocked(loginAede).mockClear();
  vi.mocked(syncAede).mockClear();
  let finish!: () => void;
  vi.mocked(logoutAede).mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  const pending = library.connect("https://replacement.example", "other-admin", "fixture");
  disposeLibrary();
  finish();
  await pending;
  expect(loginAede).not.toHaveBeenCalled();
  expect(syncAede).not.toHaveBeenCalled();
  expect(vi.getTimerCount()).toBe(0);
});
it("does not change routing when local shutdown finishes after provider disposal", async () => {
  const library = mountLibrary();
  await library.enableLocal();
  expect(library.source()).toBe("local");
  let finish!: () => void;
  vi.mocked(stopLocal).mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  const pending = library.disableLocal();
  disposeLibrary();
  vi.mocked(setRequestSource).mockClear();
  finish();
  await pending;
  expect(setRequestSource).not.toHaveBeenCalled();
});

it("still restores process ownership and stops polling when an active recovery context is disposed", async () => {
  const library = mountLibrary();
  const owner = {
    nativeSession: "existing-session",
    server: "https://fixture.example",
    account: { id: "fixture-admin", username: "fixture-admin", role: "admin" },
  };
  vi.mocked(loginAede).mockRejectedValueOnce(
    new Error("Déconnectez la session active avant de changer de compte."),
  );
  vi.mocked(restoreAedeSession).mockResolvedValueOnce(owner);
  await library.connect(owner.server, owner.account.username, "fixture");
  expect(restoreAedeSession).toHaveBeenCalledExactlyOnceWith("server");
  expect(library.serverSession()).toBe(owner);
  expect(library.connected()).toBe(true);
  const initialSessionReads = vi
    .mocked(requestAede)
    .mock.calls.filter(([path]) => path === "/api/auth/v1/session");
  expect(initialSessionReads.length).toBeGreaterThan(0);
  for (const [, , , , source, captured] of initialSessionReads) {
    expect(source).toBe("server");
    expect(captured).toBe(owner);
  }
  disposeLibrary();
  await vi.advanceTimersByTimeAsync(45000);
  expect(vi.getTimerCount()).toBe(0);
  expect(
    vi.mocked(requestAede).mock.calls.filter(([path]) => path === "/api/auth/v1/session"),
  ).toEqual(initialSessionReads);
});

it.each([false, true])(
  "keeps a reconnected local session when an earlier shutdown replies (failed=%s)",
  async (failed) => {
    const library = mountLibrary();
    await library.enableLocal();
    let finish!: () => void;
    vi.mocked(stopLocal).mockImplementationOnce(
      () =>
        new Promise<void>((resolve, reject) => {
          finish = () => (failed ? reject(new Error("obsolete local shutdown")) : resolve());
        }),
    );
    const pending = library.disableLocal();
    expect(library.localSession()).toBeUndefined();
    const replacement = {
      nativeSession: "replacement-local-session",
      server: "https://fixture.example",
      account: { id: "fixture-admin", username: "fixture-admin", role: "admin" },
    };
    vi.mocked(startLocal).mockResolvedValueOnce(replacement);
    await library.enableLocal();
    expect(library.localSession()).toBe(replacement);
    const message = library.error();
    vi.mocked(setRequestSource).mockClear();
    finish();
    await pending;
    expect(library.localSession()).toBe(replacement);
    expect(library.source()).toBe("local");
    expect(setRequestSource).not.toHaveBeenCalled();
    expect(library.error()).toBe(message);
    expect(library.busy()).toBe(false);
  },
);

it("keeps the current local shutdown failure visible", async () => {
  const library = mountLibrary();
  await library.enableLocal();
  vi.mocked(stopLocal).mockRejectedValueOnce(new Error("current local shutdown failed"));
  await library.disableLocal();
  expect(library.localSession()).toBeUndefined();
  expect(library.error()).toBe("current local shutdown failed");
});

it.each([
  ["server", "policy"],
  ["server", "catalogue"],
  ["local", "policy"],
  ["local", "catalogue"],
] as const)("retires a stopped %s catalogue reload at the %s stage", async (source, stage) => {
  const library = mountLibrary();
  if (source === "server")
    await library.connect("https://fixture.example", "fixture-admin", "fixture");
  else await library.enableLocal();
  vi.mocked(syncAede).mockClear();
  const before = library.publicSnapshot(source);
  let finish!: () => void;
  if (stage === "policy") {
    vi.spyOn(library.parental, "refresh").mockReturnValueOnce(
      new Promise<undefined>((done) => {
        finish = () => done(undefined);
      }),
    );
  } else {
    const raw = await syncAede(source);
    vi.mocked(syncAede).mockClear();
    vi.mocked(syncAede).mockImplementationOnce(
      () =>
        new Promise((done) => {
          finish = () => done(raw);
        }),
    );
  }
  const controller = new AbortController(),
    pending = library.sync(source, controller.signal);
  for (let i = 0; i < 20; i++) await Promise.resolve();
  expect(library.busy()).toBe(true);
  controller.abort();
  finish();
  await pending;
  expect(syncAede).toHaveBeenCalledTimes(stage === "policy" ? 0 : 1);
  expect(library.publicSnapshot(source)).toBe(before);
  expect(library.busy()).toBe(false);
  expect(library.error()).toBe("");
});

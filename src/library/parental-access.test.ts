import { createComputed, createRoot, createSignal } from "solid-js";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createParentalAccess } from "./parental-access";
import { parentalStatus, settleParental } from "./parental-test-fixtures";
import type { AccountSession, Snapshot } from "./server";
beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());
const owner = (): AccountSession => ({
  nativeSession: "one",
  server: "http://fixture.invalid",
  account: { id: "child", username: "child", role: "user", parental_enabled: true },
});
const status = () => ({
  ...parentalStatus(),
  policy: { ...parentalStatus().policy, enabled: true },
});
const deferred = () => {
  let resolve!: (value: unknown) => void;
  const promise = new Promise<unknown>((done) => {
    resolve = done;
  });
  return { promise, resolve };
};
it("coalesces overlapping status and media admission reads under the same exact source and owner", async () => {
  const session = owner(),
    pending = deferred(),
    request = vi.fn().mockReturnValue(pending.promise);
  let dispose!: () => void;
  const access = createRoot((end) => {
    dispose = end;
    return createParentalAccess({
      session: (source) => (source === "server" ? session : undefined),
      source: () => "server",
      changed: vi.fn(),
      unavailable: vi.fn(),
      request,
    });
  });
  try {
    const one = access.refresh("server"),
      two = access.check({ kind: "radio" });
    expect(request).toHaveBeenCalledExactlyOnceWith(
      "/api/me/v1/parental",
      {},
      "GET",
      null,
      "server",
      session,
    );
    pending.resolve(status());
    expect(await one).toEqual(status());
    expect(await two).toEqual({ source: "server", owner: session, status: status() });
  } finally {
    dispose();
  }
});
it("refuses late old-session status without replacing the new account or reporting its error", async () => {
  const first = owner(),
    [session, setSession] = createSignal<AccountSession | undefined>(first),
    pending = deferred();
  const request = vi
      .fn()
      .mockReturnValueOnce(pending.promise)
      .mockResolvedValue({ ...status(), owner: "next" }),
    unavailable = vi.fn();
  let dispose!: () => void;
  const access = createRoot((end) => {
    dispose = end;
    return createParentalAccess({
      session: (source) => (source === "server" ? session() : undefined),
      source: () => "server",
      changed: vi.fn(),
      unavailable,
      request,
    });
  });
  try {
    const read = access.refresh("server");
    setSession({ ...first, account: { ...first.account, id: "next" } });
    await settleParental();
    expect(access.status()?.owner).toBe("next");
    pending.resolve(status());
    await expect(read).rejects.toThrow("Session");
    expect(access.status()?.owner).toBe("next");
    expect(unavailable).not.toHaveBeenCalled();
    setSession(undefined);
    expect(access.status()).toBeUndefined();
    expect(access.available()).toBe(true);
  } finally {
    dispose();
  }
});
it("does not read policies for guests, administrators or older unsupported servers", async () => {
  for (const session of [
    undefined,
    { ...owner(), account: { ...owner().account, role: "admin" } },
    {
      server: "http://fixture.invalid",
      account: { id: "legacy", username: "legacy", role: "user" },
    },
  ]) {
    const request = vi
      .fn()
      .mockImplementation(async () =>
        session ? { ...session.account, enabled: true } : undefined,
      );
    let dispose!: () => void;
    const access = createRoot((end) => {
      dispose = end;
      return createParentalAccess({
        session: () => session,
        source: () => "server",
        changed: vi.fn(),
        unavailable: vi.fn(),
        request,
      });
    });
    try {
      expect(await access.check({ kind: "radio" })).toBeUndefined();
      await vi.advanceTimersByTimeAsync(20000);
      if (!session) expect(request).not.toHaveBeenCalled();
      else {
        expect(request).toHaveBeenCalled();
        for (const [path, , , , , captured] of request.mock.calls) {
          expect(path).toBe("/api/auth/v1/session");
          expect(captured).toBe(session);
        }
        expect(access.status()).toBeUndefined();
      }
      expect(access.radioAllowed()).toBe(true);
    } finally {
      dispose();
    }
  }
});
it("blocks catalogue and external listening after a policy read failure, retaining the last confirmed restriction", async () => {
  const session = owner(),
    request = vi.fn().mockResolvedValueOnce(status()).mockRejectedValue(Error("Unavailable")),
    unavailable = vi.fn();
  let dispose!: () => void;
  const access = createRoot((end) => {
    dispose = end;
    return createParentalAccess({
      session: (source) => (source === "server" ? session : undefined),
      source: () => "server",
      changed: vi.fn(),
      unavailable,
      request,
    });
  });
  try {
    await settleParental();
    expect(access.available()).toBe(true);
    await expect(access.refresh("server")).rejects.toThrow("Unavailable");
    expect(access.status()?.policy.enabled).toBe(true);
    expect(access.available()).toBe(false);
    expect(access.catalogVisible("server", undefined)).toBe(false);
    expect(access.radioAllowed()).toBe(false);
    expect(access.podcastAllowed("https://example.invalid/feed")).toBe(false);
    expect(unavailable).toHaveBeenCalledOnce();
  } finally {
    dispose();
  }
});
it("invalidates a cached projection when an administrator restores a different policy at the same revision", async () => {
  const session = owner(),
    initial = status(),
    restored = {
      ...initial,
      policy: {
        ...initial.policy,
        blocked_artists: ["artist:hidden"],
        blocked_podcasts: ["https://example.invalid/blocked"],
        radio_allowed: false,
      },
    };
  const request = vi.fn().mockResolvedValueOnce(initial).mockResolvedValue(restored),
    changed = vi.fn();
  let dispose!: () => void;
  const access = createRoot((end) => {
    dispose = end;
    return createParentalAccess({
      session: (source) => (source === "server" ? session : undefined),
      source: () => "server",
      changed,
      unavailable: vi.fn(),
      request,
    });
  });
  const cache: Snapshot = {
    artists: [],
    albums: [],
    server: session.server,
    accountId: "child",
    scannedAt: 1,
    parentalEnabled: true,
    parentalRevision: 0,
    parentalPolicy: initial.policy,
  };
  try {
    await settleParental();
    expect(access.catalogVisible("server", cache)).toBe(true);
    const beforeScope = access.viewScope();
    await access.refresh("server");
    expect(access.viewScope()).not.toBe(beforeScope);
    expect(changed).toHaveBeenCalledTimes(2);
    expect(access.catalogVisible("server", cache)).toBe(false);
    expect(access.catalogVisible("server", { ...cache, parentalPolicy: restored.policy })).toBe(
      true,
    );
    expect(access.radioAllowed()).toBe(false);
    expect(access.podcastAllowed("https://example.invalid/blocked#fragment")).toBe(false);
    await expect(access.check({ kind: "radio" })).rejects.toThrow("radios");
    await expect(
      access.check({ kind: "podcast", feed: "https://example.invalid/blocked#fragment" }),
    ).rejects.toThrow("podcast");
  } finally {
    dispose();
  }
});
it("does not publish a policy or schedule another poll after disposal", async () => {
  const session = owner(),
    pending = deferred(),
    request = vi.fn().mockReturnValue(pending.promise),
    changed = vi.fn();
  let dispose!: () => void;
  const access = createRoot((end) => {
    dispose = end;
    return createParentalAccess({
      session: () => session,
      source: () => "server",
      changed,
      unavailable: vi.fn(),
      request,
    });
  });
  const read = access.refresh("server");
  dispose();
  pending.resolve(status());
  await expect(read).rejects.toThrow("Session");
  await vi.advanceTimersByTimeAsync(10000);
  expect(changed).not.toHaveBeenCalled();
  expect(request).toHaveBeenCalledTimes(2);
});

it("keeps catalogue and media admission stable when only listening counters change", async () => {
  const session = owner(),
    initial = status(),
    request = vi.fn().mockResolvedValue(initial);
  const cache: Snapshot = {
    artists: [],
    albums: [],
    server: session.server,
    accountId: "child",
    scannedAt: 1,
    parentalEnabled: true,
    parentalRevision: 0,
    parentalPolicy: initial.policy,
  };
  let dispose!: () => void,
    catalogUpdates = 0,
    mediaUpdates = 0;
  const access = createRoot((end) => {
    dispose = end;
    const value = createParentalAccess({
      session: (source) => (source === "server" ? session : undefined),
      source: () => "server",
      changed: vi.fn(),
      unavailable: vi.fn(),
      request,
    });
    createComputed(() => {
      value.catalogVisible("server", cache);
      catalogUpdates++;
    });
    createComputed(() => {
      value.radioAllowed();
      value.podcastAllowed("https://example.invalid/feed");
      mediaUpdates++;
    });
    return value;
  });
  try {
    await settleParental();
    const beforeCatalog = catalogUpdates,
      beforeMedia = mediaUpdates,
      beforeScope = access.viewScope();
    request.mockResolvedValue({ ...initial, day_used_seconds: 5, week_used_seconds: 5 });
    await access.refresh("server");
    expect(access.status()?.day_used_seconds).toBe(5);
    expect(access.viewScope()).toBe(beforeScope);
    expect(catalogUpdates).toBe(beforeCatalog);
    expect(mediaUpdates).toBe(beforeMedia);
  } finally {
    dispose();
  }
});
it("requests a fresh admitted catalogue when an unavailable policy recovers at the same revision", async () => {
  const session = owner(),
    request = vi
      .fn()
      .mockResolvedValueOnce(status())
      .mockRejectedValueOnce(Error("Unavailable"))
      .mockResolvedValue(status()),
    changed = vi.fn();
  let dispose!: () => void;
  const access = createRoot((end) => {
    dispose = end;
    return createParentalAccess({
      session: (source) => (source === "server" ? session : undefined),
      source: () => "server",
      changed,
      unavailable: vi.fn(),
      request,
    });
  });
  try {
    await settleParental();
    expect(changed).toHaveBeenCalledOnce();
    await expect(access.refresh("server")).rejects.toThrow();
    await access.refresh("server");
    expect(changed).toHaveBeenCalledTimes(2);
  } finally {
    dispose();
  }
});

it("refuses all podcasts without RSS entries and restores guest/admin access independently", async () => {
  const [session, setSession] = createSignal<AccountSession | undefined>(owner());
  const rules = status();
  rules.policy.podcasts_allowed = false;
  const request = vi.fn().mockResolvedValue(rules);
  let dispose!: () => void;
  const access = createRoot((end) => {
    dispose = end;
    return createParentalAccess({
      session: (source) => (source === "server" ? session() : undefined),
      source: () => "server",
      changed: vi.fn(),
      unavailable: vi.fn(),
      request,
    });
  });
  try {
    await settleParental();
    expect(access.podcastsAllowed()).toBe(false);
    expect(access.podcastAllowed("https://example.invalid/any-feed")).toBe(false);
    await expect(
      access.check({ kind: "podcast", feed: "https://example.invalid/any-feed" }),
    ).rejects.toThrow("podcast");
    const administrator = {
      ...owner(),
      account: { id: "parent", username: "parent", role: "admin" },
    };
    request.mockResolvedValue({ ...administrator.account, enabled: true });
    setSession(administrator);
    await settleParental();
    expect(access.podcastsAllowed()).toBe(true);
    expect(access.podcastAllowed("https://example.invalid/any-feed")).toBe(true);
    setSession(undefined);
    expect(access.podcastsAllowed()).toBe(true);
  } finally {
    dispose();
  }
});

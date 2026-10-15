import { createRoot, createSignal } from "solid-js";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createParentalMedia } from "./parental-media";
import { parentalStatus, settleParental } from "./parental-test-fixtures";
import type { AccountSession } from "./server";
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date", "performance"] });
  vi.setSystemTime(new Date("2030-01-01T12:00:00Z"));
});
afterEach(() => vi.useRealTimers());
const owner = (): AccountSession => ({
  server: "http://fixture.invalid",
  nativeSession: "lease-session",
  account: { id: "child", username: "child", role: "user" },
});
const grant = (id = "lease-example", seconds = 10) => ({
  lease_id: id,
  granted_seconds: seconds,
  expires_at: Math.floor(Date.now() / 1000) + seconds,
  server_now_ms: Date.now(),
});
const deferred = () => {
  let resolve!: (value: unknown) => void;
  const promise = new Promise<unknown>((done) => {
    resolve = done;
  });
  return { promise, resolve };
};
it("reserves exact current-owner media, renews bounded leases and releases on pause without renewing again", async () => {
  const session = owner(),
    scope = {
      source: "server" as const,
      owner: session,
      status: { ...parentalStatus(), policy: { ...parentalStatus().policy, enabled: true } },
    };
  const check = vi.fn().mockResolvedValue(scope),
    request = vi
      .fn()
      .mockImplementation(async (_path, _query, _method, body) =>
        body.action === "release" ? undefined : grant(),
      ),
    stop = vi.fn();
  let dispose!: () => void;
  const guard = createRoot((end) => {
    dispose = end;
    return createParentalMedia({
      access: { check },
      source: () => "server",
      session: () => session,
      request,
      stop,
      error: vi.fn(),
    });
  });
  try {
    await guard.authorize({ kind: "radio" });
    guard.observe("playing");
    expect(check).toHaveBeenCalledExactlyOnceWith({ kind: "radio" }, "server", session);
    expect(request).toHaveBeenCalledExactlyOnceWith(
      "/api/me/v1/parental/lease",
      {},
      "POST",
      { action: "reserve", media: { kind: "radio" }, seconds: 10 },
      "server",
      session,
    );
    await vi.advanceTimersByTimeAsync(5000);
    expect(request).toHaveBeenLastCalledWith(
      "/api/me/v1/parental/lease",
      {},
      "POST",
      { action: "renew", lease_id: "lease-example", consumed_ms: 5000, seconds: 10 },
      "server",
      session,
    );
    guard.observe("paused");
    await settleParental();
    expect(request).toHaveBeenLastCalledWith(
      "/api/me/v1/parental/lease",
      {},
      "POST",
      { action: "release", lease_id: "lease-example", consumed_ms: 0 },
      "server",
      session,
    );
    const count = request.mock.calls.length;
    await vi.advanceTimersByTimeAsync(60000);
    expect(request).toHaveBeenCalledTimes(count);
    expect(stop).not.toHaveBeenCalled();
  } finally {
    dispose();
  }
  expect(vi.getTimerCount()).toBe(0);
});
it("cuts audio at the original deadline when native renewal never returns", async () => {
  const session = owner(),
    pending = deferred(),
    stop = vi.fn(),
    error = vi.fn(),
    scope = { source: "server" as const, owner: session, status: parentalStatus() };
  const request = vi
    .fn()
    .mockResolvedValueOnce(grant())
    .mockReturnValueOnce(pending.promise)
    .mockResolvedValue(undefined);
  let dispose!: () => void;
  const guard = createRoot((end) => {
    dispose = end;
    return createParentalMedia({
      access: { check: async () => scope },
      source: () => "server",
      session: () => session,
      request,
      stop,
      error,
    });
  });
  try {
    await guard.authorize({ kind: "podcast", feed: "https://example.invalid/feed" });
    guard.observe("playing");
    await vi.advanceTimersByTimeAsync(5000);
    expect(request).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(5000);
    expect(stop).toHaveBeenCalledOnce();
    expect(error).toHaveBeenCalledWith("L’autorisation d’écoute a expiré.");
    pending.resolve(grant());
    await settleParental();
    await vi.advanceTimersByTimeAsync(20000);
    expect(stop).toHaveBeenCalledOnce();
    expect(request.mock.calls.filter((call) => call[3].action === "release")).toHaveLength(1);
  } finally {
    dispose();
  }
});
it("releases a late reservation after Stop and does not authorize a replaced session", async () => {
  for (const replace of [false, true]) {
    const first = owner(),
      [session, setSession] = createSignal<AccountSession | undefined>(first),
      pending = deferred();
    const request = vi.fn().mockReturnValueOnce(pending.promise).mockResolvedValue(undefined),
      stop = vi.fn();
    let dispose!: () => void;
    const guard = createRoot((end) => {
      dispose = end;
      return createParentalMedia({
        access: {
          check: async () => ({ source: "server", owner: first, status: parentalStatus() }),
        },
        source: () => "server",
        session,
        request,
        stop,
        error: vi.fn(),
      });
    });
    try {
      const admission = guard.authorize({ kind: "radio" });
      await settleParental();
      if (replace) setSession({ ...first });
      else guard.stop();
      pending.resolve(grant());
      await expect(admission).rejects.toThrow("Session");
      expect(request).toHaveBeenLastCalledWith(
        "/api/me/v1/parental/lease",
        {},
        "POST",
        { action: "release", lease_id: "lease-example", consumed_ms: 0 },
        "server",
        first,
      );
      expect(stop).toHaveBeenCalledTimes(replace ? 1 : 0);
    } finally {
      dispose();
    }
  }
});
it("keeps guests/admin/unrestricted playback independent and rejects malformed or expired grants", async () => {
  let dispose!: () => void;
  const request = vi.fn();
  const unrestricted = createRoot((end) => {
    dispose = end;
    return createParentalMedia({
      access: { check: async () => undefined },
      source: () => "server",
      session: () => undefined,
      request,
      stop: vi.fn(),
      error: vi.fn(),
    });
  });
  await unrestricted.authorize({ kind: "radio" });
  unrestricted.observe("playing");
  await vi.advanceTimersByTimeAsync(60000);
  expect(request).not.toHaveBeenCalled();
  dispose();
  const session = owner();
  for (const value of [
    { ...grant(), granted_seconds: 0 },
    { ...grant(), expires_at: NaN },
    { ...grant(), server_now_ms: NaN },
    { ...grant(), server_now_ms: undefined },
    { ...grant(), server_now_ms: grant().expires_at * 1000 },
  ]) {
    request.mockReset().mockResolvedValueOnce(value).mockResolvedValue(undefined);
    const restricted = createRoot((end) => {
      dispose = end;
      return createParentalMedia({
        access: {
          check: async () => ({ source: "server", owner: session, status: parentalStatus() }),
        },
        source: () => "server",
        session: () => session,
        request,
        stop: vi.fn(),
        error: vi.fn(),
      });
    });
    await expect(restricted.authorize({ kind: "radio" })).rejects.toThrow();
    dispose();
  }
});

it("counts only playing time and releases only the unreported delta after an in-flight renewal", async () => {
  const session = owner(),
    pending = deferred(),
    request = vi
      .fn()
      .mockResolvedValueOnce(grant())
      .mockReturnValueOnce(pending.promise)
      .mockResolvedValue(undefined);
  let dispose!: () => void;
  const guard = createRoot((end) => {
    dispose = end;
    return createParentalMedia({
      access: {
        check: async () => ({ source: "server", owner: session, status: parentalStatus() }),
      },
      source: () => "server",
      session: () => session,
      request,
      stop: vi.fn(),
      error: vi.fn(),
    });
  });
  try {
    await guard.authorize({ kind: "radio" });
    guard.observe("connecting");
    await vi.advanceTimersByTimeAsync(2000);
    guard.observe("playing");
    await vi.advanceTimersByTimeAsync(5000);
    expect(request.mock.calls[1]?.[3]).toEqual({
      action: "renew",
      lease_id: "lease-example",
      consumed_ms: 5000,
      seconds: 10,
    });
    await vi.advanceTimersByTimeAsync(1000);
    guard.observe("paused");
    expect(request).toHaveBeenCalledTimes(2);
    pending.resolve(grant());
    await settleParental();
    expect(request).toHaveBeenLastCalledWith(
      "/api/me/v1/parental/lease",
      {},
      "POST",
      { action: "release", lease_id: "lease-example", consumed_ms: 1000 },
      "server",
      session,
    );
    expect(guard.source()).toBeUndefined();
  } finally {
    dispose();
  }
});

it("keeps the captured authority across UI source changes and ignores a skewed client wall clock", async () => {
  vi.setSystemTime(new Date("2090-01-01T00:00:00Z"));
  const first = owner(),
    [source, setSource] = createSignal<"local" | "server">("server"),
    stop = vi.fn();
  const request = vi.fn().mockResolvedValue({
    lease_id: "lease-example",
    granted_seconds: 10,
    expires_at: 1893456010,
    server_now_ms: 1893456000000,
  });
  let dispose!: () => void;
  const guard = createRoot((end) => {
    dispose = end;
    return createParentalMedia({
      access: { check: async () => ({ source: "server", owner: first, status: parentalStatus() }) },
      source,
      session: (scope) => (scope === "server" ? first : undefined),
      request,
      stop,
      error: vi.fn(),
    });
  });
  try {
    await guard.authorize({ kind: "radio" });
    guard.observe("playing");
    setSource("local");
    expect(guard.source()).toBe("server");
    expect(stop).not.toHaveBeenCalled();
    guard.observe("connecting");
    await vi.advanceTimersByTimeAsync(10000);
    expect(stop).toHaveBeenCalledOnce();
  } finally {
    dispose();
  }
});
it("rejects a grant whose bounded budget elapsed while the reserve request was pending", async () => {
  const first = owner(),
    pending = deferred(),
    request = vi.fn().mockReturnValueOnce(pending.promise).mockResolvedValue(undefined);
  let dispose!: () => void;
  const guard = createRoot((end) => {
    dispose = end;
    return createParentalMedia({
      access: { check: async () => ({ source: "server", owner: first, status: parentalStatus() }) },
      source: () => "server",
      session: () => first,
      request,
      stop: vi.fn(),
      error: vi.fn(),
    });
  });
  try {
    const authorization = guard.authorize({ kind: "radio" });
    await settleParental();
    await vi.advanceTimersByTimeAsync(10000);
    pending.resolve(grant());
    await expect(authorization).rejects.toThrow("expiré");
    expect(request).toHaveBeenLastCalledWith(
      "/api/me/v1/parental/lease",
      {},
      "POST",
      { action: "release", lease_id: "lease-example", consumed_ms: 0 },
      "server",
      first,
    );
  } finally {
    dispose();
  }
});

it("admits a final one-second grant and bounds it by the server serialization clock", async () => {
  const first = owner(),
    stop = vi.fn();
  const request = vi.fn().mockResolvedValue({
    lease_id: "lease-example",
    granted_seconds: 1,
    expires_at: 1893456001,
    server_now_ms: 1893456000250,
  });
  let dispose!: () => void;
  const guard = createRoot((end) => {
    dispose = end;
    return createParentalMedia({
      access: { check: async () => ({ source: "server", owner: first, status: parentalStatus() }) },
      source: () => "server",
      session: () => first,
      request,
      stop,
      error: vi.fn(),
    });
  });
  try {
    await guard.authorize({ kind: "radio" });
    guard.observe("connecting");
    await vi.advanceTimersByTimeAsync(749);
    expect(stop).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(stop).toHaveBeenCalledOnce();
  } finally {
    dispose();
  }
});

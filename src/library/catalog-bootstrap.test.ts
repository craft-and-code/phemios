import { expect, it, vi } from "vitest";
import { createCatalogBootstrap } from "./catalog-bootstrap";
import type { AccountSession } from "./server";
import type { SourceId } from "./sources";
const account = (server: string): AccountSession => ({
  server,
  account: { id: "same-id", username: "listener", role: "user" },
});
function deferred<T>() {
  let resolve!: (value: T) => void, reject!: (failure: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
it("keeps a synchronized projection when its older cache finishes, without discarding the other source", async () => {
  const server = deferred<number | null>(),
    local = deferred<number | null>(),
    projections = new Map<SourceId, number>();
  const cache = createCatalogBootstrap({
    session: () => undefined,
    read: (source) => (source === "server" ? server.promise : local.promise),
    publish: (source, value) => {
      projections.set(source, value);
    },
    failed: vi.fn(),
  });
  const oldServer = cache.load("server"),
    oldLocal = cache.load("local");
  const current = cache.capture("server");
  expect(current()).toBe(true);
  projections.set("server", 42);
  server.resolve(1);
  local.resolve(2);
  expect(await oldServer).toBe(false);
  expect(await oldLocal).toBe(true);
  expect([...projections]).toEqual([
    ["server", 42],
    ["local", 2],
  ]);
});
it("does not start a late bootstrap read after that source has already synchronized", async () => {
  const read = vi.fn(async () => 1),
    publish = vi.fn();
  const cache = createCatalogBootstrap({
    session: () => undefined,
    read,
    publish,
    failed: vi.fn(),
  });
  cache.invalidate("local");
  expect(await cache.load("local")).toBe(false);
  expect(read).not.toHaveBeenCalled();
  expect(publish).not.toHaveBeenCalled();
});
it("ignores cache replies and errors from a replaced authority even with the same account id", async () => {
  for (const fails of [false, true]) {
    const request = deferred<number | null>(),
      publish = vi.fn(),
      failed = vi.fn();
    let owner = account("https://first.example");
    const cache = createCatalogBootstrap({
      session: () => owner,
      read: () => request.promise,
      publish,
      failed,
    });
    const old = cache.load("server");
    owner = account("https://second.example");
    if (fails) request.reject(new Error("Old authority cache failure"));
    else request.resolve(1);
    expect(await old).toBe(false);
    expect(publish).not.toHaveBeenCalled();
    expect(failed).not.toHaveBeenCalled();
  }
});
it("invalidates outstanding projection tickets and pending cache work on disposal", async () => {
  const request = deferred<number | null>(),
    publish = vi.fn(),
    failed = vi.fn();
  const cache = createCatalogBootstrap({
    session: () => undefined,
    read: () => request.promise,
    publish,
    failed,
  });
  const old = cache.load("server"),
    current = cache.capture("local");
  cache.dispose();
  request.resolve(1);
  expect(await old).toBe(false);
  expect(current()).toBe(false);
  expect(cache.active()).toBe(false);
  expect(publish).not.toHaveBeenCalled();
});

it("restores process identity without needing credentials, but never after an explicit logout or disposal", async () => {
  for (const retire of ["logout", "dispose"] as const) {
    const request = deferred<AccountSession | undefined>();
    const publish = vi.fn();
    const bootstrap = createCatalogBootstrap({
      session: () => undefined,
      read: async () => null,
      publish: vi.fn(),
      failed: vi.fn(),
    });
    const pending = bootstrap.restoreSession("server", () => request.promise, publish);
    if (retire === "logout") bootstrap.invalidate("server");
    else bootstrap.dispose();
    request.resolve(account("https://fixture.example"));
    expect(await pending).toBe(false);
    expect(publish).not.toHaveBeenCalled();
  }
});
it("restores local and remote sessions independently and skips an already engaged source", async () => {
  const publish = vi.fn(),
    read = vi.fn(async () => account("https://fixture.example"));
  const bootstrap = createCatalogBootstrap({
    session: () => undefined,
    read: async () => null,
    publish: vi.fn(),
    failed: vi.fn(),
  });
  bootstrap.invalidate("server");
  expect(await bootstrap.restoreSession("server", read, publish)).toBe(false);
  expect(read).not.toHaveBeenCalled();
  expect(await bootstrap.restoreSession("local", read, publish)).toBe(true);
  expect(publish).toHaveBeenCalledWith("local", account("https://fixture.example"));
});

import { afterEach, expect, it, vi } from "vitest";
import { WebSession } from "./session";
const login = (id: string, parental = false) =>
  new Response(
    JSON.stringify({
      token: id === "first" ? "a".repeat(64) : "b".repeat(64),
      account: { id, username: id, role: "user", parental_enabled: parental },
    }),
  );
afterEach(() => vi.unstubAllGlobals());
it("forwards bearer credentials only in headers and destroys local identity before deferred logout", async () => {
  let finish!: (response: Response) => void;
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(login("first"))
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
  vi.stubGlobal("fetch", fetcher);
  const retire = vi.fn(),
    session = new WebSession("https://music.example", retire);
  await session.login("https://music.example", "first", "password");
  const retired = session.logout();
  expect(session.current()).toBeUndefined();
  expect(retire).toHaveBeenCalledTimes(2);
  const [url, options] = fetcher.mock.calls[1]!;
  expect(url).not.toContain("a".repeat(64));
  expect(options.headers.Authorization).toBe(`Bearer ${"a".repeat(64)}`);
  expect(options.credentials).toBe("omit");
  expect(options.redirect).toBe("error");
  finish(new Response(null, { status: 204 }));
  await retired;
});
it("does not let a replaced login adopt a later generation after waiting for logout", async () => {
  let releaseLogout!: (response: Response) => void;
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(login("first"))
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          releaseLogout = resolve;
        }),
    )
    .mockResolvedValueOnce(login("second"));
  vi.stubGlobal("fetch", fetcher);
  const session = new WebSession("https://music.example", () => {});
  await session.login("https://music.example", "first", "password");
  const pending = session.login("https://music.example", "old", "password").catch((error) => error);
  await session.login("https://music.example", "second", "password");
  releaseLogout(new Response(null, { status: 204 }));
  expect(await pending).toBeInstanceOf(Error);
  expect(session.current()?.account.id).toBe("second");
  expect(fetcher).toHaveBeenCalledTimes(3);
});
it("retires an already dispatched data response on account replacement", async () => {
  let finish!: (response: Response) => void;
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(login("first"))
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    )
    .mockResolvedValue(new Response(null, { status: 204 }));
  vi.stubGlobal("fetch", fetcher);
  const session = new WebSession("https://music.example", () => {});
  await session.login("https://music.example", "first", "password");
  const request = session.request("/api/v1/status").catch((error) => error);
  await session.logout();
  finish(new Response('{"private":"old-owner"}'));
  expect(await request).toBeInstanceOf(Error);
});
it("refuses supervised export playback and does not retain that account", async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValueOnce(login("first", true))
      .mockResolvedValue(new Response(null, { status: 204 })),
  );
  const session = new WebSession("https://music.example", () => {});
  await expect(session.login("https://music.example", "first", "password")).rejects.toThrow(
    "supervisé",
  );
  expect(session.current()).toBeUndefined();
});

it("logout aborts a dispatched login and refuses a late minted session", async () => {
  let finish!: (response: Response) => void;
  let signal!: AbortSignal;
  const fetcher = vi
    .fn()
    .mockImplementationOnce((_url, options) => {
      signal = options.signal;
      return new Promise((resolve) => {
        finish = resolve;
      });
    })
    .mockResolvedValue(new Response(null, { status: 204 }));
  vi.stubGlobal("fetch", fetcher);
  const session = new WebSession("https://music.example", () => {});
  const loginRequest = session.login("https://music.example", "first", "password").catch((e) => e);
  for (let i = 0; i < 4; i++) await Promise.resolve();
  await session.logout();
  expect(signal.aborted).toBe(true);
  finish(login("first"));
  expect(await loginRequest).toBeInstanceOf(Error);
  expect(session.current()).toBeUndefined();
  expect(fetcher).toHaveBeenLastCalledWith(
    "https://music.example/api/auth/v1/session",
    expect.objectContaining({
      method: "DELETE",
      headers: { Authorization: `Bearer ${"a".repeat(64)}` },
    }),
  );
});
it("a cancelled media plan cannot start an original-file request", async () => {
  let finish!: (response: Response) => void;
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(login("first"))
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
  vi.stubGlobal("fetch", fetcher);
  const session = new WebSession("https://music.example", () => {});
  await session.login("https://music.example", "first", "password");
  const controller = new AbortController();
  const request = session.media("track:first", controller.signal).catch((e) => e);
  controller.abort();
  finish(
    new Response(
      JSON.stringify({ items: [{ reference: "track:first", stamp: "stamp", bytes: 50 }] }),
    ),
  );
  expect(await request).toBeInstanceOf(Error);
  expect(fetcher).toHaveBeenCalledTimes(2);
});

it("live supervision retires Web audio instead of using unaccounted original exports", async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValueOnce(login("first"))
      .mockResolvedValueOnce(new Response(JSON.stringify({ policy: { enabled: true } }))),
  );
  const retire = vi.fn(),
    session = new WebSession("https://music.example", retire);
  await session.login("https://music.example", "first", "password");
  retire.mockClear();
  await expect(session.request("/api/me/v1/parental")).rejects.toThrow("desktop");
  expect(retire).toHaveBeenCalledOnce();
});

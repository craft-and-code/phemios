import { expect, it, vi } from "vitest";
import { readAdvancedTrackPage } from "./advanced-track-read";
const owner = {
  server: "https://music.example",
  nativeSession: "alice",
  account: { id: "alice", username: "alice", role: "user" },
};
it("does not dispatch a search after its capability probe is retired", async () => {
  let finish!: (value: unknown) => void;
  let current = true;
  const request = vi.fn((path: string) =>
    path.endsWith("status")
      ? new Promise((resolve) => {
          finish = resolve;
        })
      : Promise.resolve({ items: [] }),
  );
  const pending = readAdvancedTrackPage(
    request,
    "server",
    "title:Echo",
    0,
    () => owner,
    () => current,
  );
  current = false;
  finish({ capabilities: ["advanced_search", "private_achievements"] });
  await expect(pending).rejects.toThrow();
  expect(request).toHaveBeenCalledOnce();
});
it("does not publish an achievement after cancellation during search", async () => {
  let finish!: (value: unknown) => void;
  let current = true;
  const request = vi.fn(async (path: string): Promise<unknown> => {
    if (path.endsWith("status"))
      return { capabilities: ["advanced_search", "private_achievements"] };
    if (path.endsWith("search"))
      return new Promise((resolve) => {
        finish = resolve;
      });
    return {};
  });
  const pending = readAdvancedTrackPage(
    request,
    "server",
    "title:Echo",
    0,
    () => owner,
    () => current,
  );
  await Promise.resolve();
  current = false;
  finish({ items: [] });
  await expect(pending).rejects.toThrow();
  expect(request).toHaveBeenCalledTimes(2);
});

it("pins every successful request to the original native owner and records only the first-page achievement", async () => {
  const answer = { items: [] };
  const request = vi.fn<Parameters<typeof readAdvancedTrackPage>[0]>(async (path: string) =>
    path.endsWith("status")
      ? { capabilities: ["advanced_search", "private_achievements"] }
      : answer,
  );
  expect(
    await readAdvancedTrackPage(
      request,
      "server",
      "title:Echo",
      0,
      () => owner,
      () => true,
    ),
  ).toBe(answer);
  expect(request.mock.calls.map((call) => call[0])).toEqual([
    "/api/v1/status",
    "/api/me/v1/search",
    "/api/me/v1/achievements",
  ]);
  for (const call of request.mock.calls) expect(call[5]).toBe(owner);
  request.mockClear();
  await readAdvancedTrackPage(
    request,
    "server",
    "title:Echo",
    50,
    () => owner,
    () => true,
  );
  expect(request).toHaveBeenCalledTimes(2);
});
it("refuses owner replacement during the capability probe even with an admitted view", async () => {
  let finish!: (value: unknown) => void;
  let active = owner;
  const request = vi.fn(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const pending = readAdvancedTrackPage(
    request,
    "server",
    "title:Echo",
    0,
    () => active,
    () => true,
  );
  active = { ...owner, nativeSession: "bob" };
  finish({ capabilities: ["advanced_search"] });
  await expect(pending).rejects.toThrow();
  expect(request).toHaveBeenCalledOnce();
});
it("does not send any native request for a retired reader or a disconnected account", async () => {
  const request = vi.fn();
  await expect(
    readAdvancedTrackPage(
      request,
      "server",
      "*",
      0,
      () => owner,
      () => false,
    ),
  ).rejects.toThrow();
  await expect(
    readAdvancedTrackPage(
      request,
      "server",
      "*",
      0,
      () => undefined,
      () => true,
    ),
  ).rejects.toThrow();
  expect(request).not.toHaveBeenCalled();
});

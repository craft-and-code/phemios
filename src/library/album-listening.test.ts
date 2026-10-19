import { createRoot, createSignal } from "solid-js";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createAlbumListening, parseAlbumListening } from "./album-listening";
import { requestAede } from "../platform/desktop";
import type { AccountSession } from "./server";
vi.mock("../platform/desktop", () => ({ requestAede: vi.fn() }));
const request = vi.mocked(requestAede);
const ref = "release:@phemios/server/fictional|example|/music";
const owner = {
  server: "http://localhost:8787",
  account: { id: "alice", username: "alice", role: "user" },
  nativeSession: "first",
} as AccountSession;
const tick = async () => {
  for (let i = 0; i < 10; i++) await Promise.resolve();
};
let dispose: () => void;
beforeEach(() => request.mockReset());
afterEach(() => dispose?.());
it("distinguishes an explicit incomplete album from a missing completion answer", () => {
  const page = { offset: 0, total: 1, items: [{ reference: ref, completed: false }] };
  expect(parseAlbumListening(page, "server", 0).items[0]?.completed).toBe(false);
  expect(() =>
    parseAlbumListening({ ...page, items: [{ reference: ref }] }, "server", 0),
  ).toThrow();
});
it("rejects mixed sources, wrong pages, duplicate or oversized answers", () => {
  const row = { reference: ref, completed: true };
  for (const page of [
    { offset: 0, total: 2, items: [row, row] },
    { offset: 1, total: 1, items: [row] },
    { offset: 0, total: 1, items: [{ ...row, reference: ref.replace("server", "local") }] },
    { offset: 0, total: 250001, items: [] },
  ])
    expect(() => parseAlbumListening(page, "server", 0)).toThrow();
});
it("does no personal work outside Albums or without a connected owner", async () => {
  createRoot((cleanup) => {
    dispose = cleanup;
    createAlbumListening({
      enabled: () => false,
      session: () => owner,
      checkpoint: () => "initial",
    });
  });
  await tick();
  expect(request).not.toHaveBeenCalled();
});
it("clears private results immediately on logout and ignores a late response", async () => {
  let done!: (value: unknown) => void;
  request
    .mockResolvedValueOnce({ capabilities: ["album_listening"] })
    .mockReturnValueOnce(new Promise((resolve) => (done = resolve)));
  const view = createRoot((cleanup) => {
    dispose = cleanup;
    const [account, setAccount] = createSignal<AccountSession | undefined>(owner);
    const data = createAlbumListening({
      enabled: () => true,
      session: (source) => (source === "server" ? account() : undefined),
      checkpoint: () => "initial",
    });
    return { data, setAccount };
  });
  await tick();
  view.setAccount(undefined);
  done({ offset: 0, total: 1, items: [{ reference: ref, completed: true }] });
  await tick();
  expect(view.data.completed(ref)).toBeUndefined();
});
it("refreshes confirmed milestones while retaining same-owner facts and admitting the latest completion", async () => {
  request
    .mockResolvedValueOnce({ capabilities: ["album_listening"] })
    .mockResolvedValueOnce({ offset: 0, total: 1, items: [{ reference: ref, completed: false }] });
  const view = createRoot((cleanup) => {
    dispose = cleanup;
    const [checkpoint, setCheckpoint] = createSignal("before");
    const data = createAlbumListening({
      enabled: () => true,
      session: (source) => (source === "server" ? owner : undefined),
      checkpoint,
    });
    return { data, setCheckpoint };
  });
  await tick();
  expect(view.data.completed(ref)).toBe(false);
  request
    .mockResolvedValueOnce({ capabilities: ["album_listening"] })
    .mockResolvedValueOnce({ offset: 0, total: 1, items: [{ reference: ref, completed: true }] });
  view.setCheckpoint("confirmed");
  expect(view.data.completed(ref)).toBe(false);
  await tick();
  expect(view.data.completed(ref)).toBe(true);
});
it("keeps an unsupported source unknown and exposes an explicit upgrade message", async () => {
  request.mockResolvedValueOnce({ capabilities: [] });
  const view = createRoot((cleanup) => {
    dispose = cleanup;
    return createAlbumListening({
      enabled: () => true,
      session: (source) => (source === "server" ? owner : undefined),
      checkpoint: () => "first",
    });
  });
  await tick();
  expect(view.completed(ref)).toBeUndefined();
  expect(view.error()).toMatch(/redémarrez/);
});

it("does not refresh completion for position, volume or spectrum-only playback updates", async () => {
  request
    .mockResolvedValueOnce({ capabilities: ["album_listening"] })
    .mockResolvedValueOnce({ offset: 0, total: 1, items: [{ reference: ref, completed: false }] });
  const view = createRoot((cleanup) => {
    dispose = cleanup;
    const [state, setState] = createSignal({
      queue: 1,
      index: 0,
      confirmed: false,
      position: 0,
      volume: 1,
      levels: [0],
    });
    createAlbumListening({
      enabled: () => true,
      session: (source) => (source === "server" ? owner : undefined),
      checkpoint: () => {
        const row = state();
        return `${row.queue}:${row.index}:${row.confirmed}`;
      },
    });
    return { state, setState };
  });
  await tick();
  const count = request.mock.calls.length;
  view.setState({ ...view.state(), position: 2000, volume: 0.5, levels: [0.8] });
  await tick();
  expect(request).toHaveBeenCalledTimes(count);
});

it("does not fetch another completion page after logout during a full first window", async () => {
  let finish!: (raw: unknown) => void;
  request.mockResolvedValueOnce({ capabilities: ["album_listening"] }).mockImplementationOnce(
    () =>
      new Promise((done) => {
        finish = done;
      }),
  );
  const [session, setSession] = createSignal<AccountSession | undefined>(owner);
  const data = createRoot((end) => {
    dispose = end;
    return createAlbumListening({
      enabled: () => true,
      session: (source) => (source === "server" ? session() : undefined),
      checkpoint: () => "first",
    });
  });
  await tick();
  expect(request).toHaveBeenCalledTimes(2);
  setSession(undefined);
  finish({
    offset: 0,
    total: 201,
    items: Array.from({ length: 200 }, (_, index) => ({
      reference: `release:@phemios/server/edition-${index}`,
      completed: true,
    })),
  });
  await tick();
  expect(request).toHaveBeenCalledTimes(2);
  expect(data.completed("release:@phemios/server/edition-0")).toBeUndefined();
  expect(data.error()).toBe("");
});

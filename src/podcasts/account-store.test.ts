import { createRoot, createSignal } from "solid-js";
import { expect, it, vi, afterEach } from "vitest";
import { readPodcastState, updatePodcastState } from "../platform/desktop";
import { createAccountPodcasts } from "./account-store";
import type { AccountSession } from "../library/server";
import type { SourceId } from "../library/sources";
import { feed } from "./test-fixtures";
vi.mock("../platform/desktop", () => ({ readPodcastState: vi.fn(), updatePodcastState: vi.fn() }));
afterEach(() => {
  vi.resetAllMocks();
  vi.unstubAllGlobals();
});
const account = (id = "one", ticket = "1", role = "user"): AccountSession => ({
  server: "https://fixture.example",
  nativeSession: ticket,
  account: { id, username: id, role },
});
const empty = { feeds: [], episodes: [] };
const retained = { feeds: [feed], episodes: [{ feed: feed.url, id: "one" }] };
const settle = async () => {
  for (let i = 0; i < 16; i++) await Promise.resolve();
};
function scope() {
  const [session, setSession] = createSignal<AccountSession | undefined>(account());
  const [source, setSource] = createSignal<SourceId>("server");
  let dispose!: () => void;
  const store = createRoot((cleanup) => {
    dispose = cleanup;
    return createAccountPodcasts(session, source);
  });
  return { store, setSession, setSource, dispose };
}
it("never exposes legacy device subscriptions or listened markers as an account's private state", async () => {
  const legacy = new Map([
      ["phemios.podcasts.v1", JSON.stringify({ version: 1, feeds: [feed] })],
      ["phemios.podcast-listened.v1", JSON.stringify({ version: 1, episodes: retained.episodes })],
    ]),
    before = [...legacy];
  const getItem = vi.fn((key: string) => legacy.get(key) ?? null);
  vi.stubGlobal("localStorage", { getItem, setItem: vi.fn() });
  vi.mocked(readPodcastState).mockResolvedValue(empty);
  const view = scope();
  try {
    await settle();
    expect(view.store.feeds()).toEqual([]);
    expect(view.store.has(feed.url, "one")).toBe(false);
    expect([...legacy]).toEqual(before);
    expect(getItem).not.toHaveBeenCalled();
  } finally {
    view.dispose();
  }
});
it.each(["logout", "relogin", "source"])(
  "hides private data and refuses captured feed/mark/remove work after %s",
  async (change) => {
    vi.mocked(readPodcastState).mockResolvedValueOnce(retained).mockResolvedValue(empty);
    const view = scope();
    try {
      await settle();
      expect(view.store.feeds()).toEqual([feed]);
      expect(view.store.has(feed.url, "one")).toBe(true);
      const held = view.store.capture();
      if (change === "source") view.setSource("local");
      else view.setSession(change === "logout" ? undefined : account("one", "2"));
      expect(view.store.feeds()).toEqual([]);
      expect(view.store.has(feed.url, "one")).toBe(false);
      await settle();
      expect(await held.save(feed)).toBe(false);
      expect(await held.mark(feed.url, "one")).toBe(false);
      expect(await held.remove(feed.url)).toBe(false);
      expect(updatePodcastState).not.toHaveBeenCalled();
    } finally {
      view.dispose();
    }
  },
);
it("ignores late reads and failed/successful writes from old owners while keeping the replacement private", async () => {
  let finish!: (value: unknown) => void;
  vi.mocked(readPodcastState)
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    )
    .mockResolvedValue(empty);
  const view = scope();
  try {
    await settle();
    view.setSession(account("two", "2"));
    await settle();
    finish(retained);
    await settle();
    expect(view.store.feeds()).toEqual([]);
    expect(view.store.has(feed.url, "one")).toBe(false);
    let release!: (value: unknown) => void;
    vi.mocked(updatePodcastState).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    );
    const write = view.store.save(feed);
    await settle();
    view.setSource("local");
    await settle();
    release(retained);
    expect(await write).toBe(false);
    expect(view.store.feeds()).toEqual([]);
    const call = vi.mocked(updatePodcastState).mock.calls[0];
    expect(call?.[2]).toBe("server");
    expect(call?.[3].nativeSession).toBe("2");
  } finally {
    view.dispose();
  }
});
it("keeps confirmed subscriptions on write failure and denies audit/disposed mutations", async () => {
  vi.mocked(readPodcastState).mockResolvedValue(retained);
  vi.mocked(updatePodcastState).mockRejectedValueOnce(new Error("Unavailable"));
  const view = scope();
  try {
    await settle();
    expect(await view.store.remove(feed.url)).toBe(false);
    expect(view.store.feeds()).toEqual([feed]);
    expect(view.store.error()).toContain("Unavailable");
    view.setSession(account("audit", "3", "auditor"));
    await settle();
    expect(view.store.writable()).toBe(false);
    expect(await view.store.mark(feed.url, "one")).toBe(false);
    expect(updatePodcastState).toHaveBeenCalledTimes(1);
    const actor = view.store.capture();
    view.dispose();
    expect(await actor.save(feed)).toBe(false);
    expect(view.store.feeds()).toEqual([]);
  } finally {
    view.dispose();
  }
});

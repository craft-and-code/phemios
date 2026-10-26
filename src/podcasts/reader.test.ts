import { createRoot, createSignal } from "solid-js";
import { expect, it, vi } from "vitest";
import { createPodcastReader } from "./reader";
import { feed } from "./test-fixtures";
it("retires a pending refresh when another subscription is selected", async () => {
  const [selected, select] = createSignal(feed.url);
  let finish!: (value: string) => void;
  const saved = vi.fn((data) => select(data.url)),
    save = vi.fn(async () => true),
    decode = vi.fn(() => feed);
  const state = createRoot((dispose) => ({
    dispose,
    reader: createPodcastReader({
      owner: () => "account-a",
      selected,
      writable: () => true,
      capture: () => ({ current: () => true, save }),
      resolve: async (value) => value,
      read: () =>
        new Promise((done) => {
          finish = done;
        }),
      allowed: () => true,
      saved,
      decode,
    }),
  }));
  const pending = state.reader.load(feed.url, "refresh");
  select("https://example.org/another-feed.xml");
  expect(state.reader.busy()).toBe("");
  finish("xml");
  await pending;
  expect(decode).not.toHaveBeenCalled();
  expect(save).not.toHaveBeenCalled();
  expect(saved).not.toHaveBeenCalled();
  expect(selected()).toBe("https://example.org/another-feed.xml");
  state.dispose();
});

it.each(["stop", "owner", "dispose"])(
  "retires feed work after %s without saving or publishing late errors",
  async (reason) => {
    const [owner, setOwner] = createSignal({});
    let fail!: (error: Error) => void;
    const save = vi.fn(async () => true),
      saved = vi.fn();
    const state = createRoot((dispose) => ({
      dispose,
      reader: createPodcastReader({
        owner,
        selected: () => feed.url,
        writable: () => true,
        capture: () => ({ current: () => true, save }),
        resolve: async (value) => value,
        read: () =>
          new Promise((_done, reject) => {
            fail = reject;
          }),
        allowed: () => true,
        saved,
      }),
    }));
    const pending = state.reader.load(feed.url, "refresh");
    if (reason === "owner") setOwner({});
    else if (reason === "dispose") state.dispose();
    else state.reader.cancel();
    fail(Error("Retired feed unavailable"));
    await pending;
    expect(state.reader.error()).toBe("");
    expect(state.reader.busy()).toBe("");
    expect(saved).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
    state.dispose();
  },
);
it("does not confuse an explicit new subscription with a refresh of the selected feed", async () => {
  const [selected, select] = createSignal(feed.url);
  const next = { ...feed, url: "https://example.org/new-feed.xml" };
  let finish!: (xml: string) => void;
  const save = vi.fn(async () => true),
    saved = vi.fn((data) => select(data.url));
  const state = createRoot((dispose) => ({
    dispose,
    reader: createPodcastReader({
      owner: () => "account",
      selected,
      writable: () => true,
      capture: () => ({ current: () => true, save }),
      resolve: async (value) => value,
      read: () =>
        new Promise((done) => {
          finish = done;
        }),
      allowed: () => true,
      saved,
      decode: () => next,
    }),
  }));
  const pending = state.reader.load(next.url);
  select("https://example.org/third-feed.xml");
  expect(state.reader.busy()).toBe("subscribe");
  finish("xml");
  await pending;
  expect(save).toHaveBeenCalledOnce();
  expect(saved).toHaveBeenCalledWith(next);
  expect(selected()).toBe(next.url);
  expect(state.reader.busy()).toBe("");
  state.dispose();
});

it("does not let an old account's failure clear the successor's acquisition", async () => {
  const [owner, setOwner] = createSignal({});
  const replies: Array<{ done: (xml: string) => void; fail: (failure: Error) => void }> = [];
  const save = vi.fn(async () => true),
    saved = vi.fn();
  const state = createRoot((dispose) => ({
    dispose,
    reader: createPodcastReader({
      owner,
      selected: () => feed.url,
      writable: () => true,
      capture: () => ({ current: () => true, save }),
      resolve: async (value) => value,
      read: () => new Promise((done, fail) => replies.push({ done, fail })),
      allowed: () => true,
      saved,
      decode: () => feed,
    }),
  }));
  const old = state.reader.load(feed.url, "refresh");
  setOwner({});
  const fresh = state.reader.load(feed.url, "refresh");
  replies[0]!.fail(Error("Old account failure"));
  await old;
  expect(state.reader.busy()).toBe("refresh");
  expect(state.reader.error()).toBe("");
  expect(saved).not.toHaveBeenCalled();
  replies[1]!.done("xml");
  await fresh;
  expect(state.reader.busy()).toBe("");
  expect(saved).toHaveBeenCalledExactlyOnceWith(feed);
  expect(save).toHaveBeenCalledOnce();
  state.dispose();
});

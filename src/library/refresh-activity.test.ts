import { createDiagnosticRead } from "./diagnostic-read";
import { createRoot, createSignal } from "solid-js";
import { afterEach, expect, it, vi } from "vitest";
import { createRefreshActivity } from "./refresh-activity";
afterEach(() => vi.useRealTimers());
it("keeps immediate reads visible for a full second of feedback", () => {
  vi.useFakeTimers();
  createRoot((dispose) => {
    const activity = createRefreshActivity();
    activity.begin();
    expect(activity.visible()).toBe(true);
    vi.advanceTimersByTime(999);
    expect(activity.visible()).toBe(true);
    vi.advanceTimersByTime(1);
    expect(activity.visible()).toBe(false);
    dispose();
  });
});
it("cancellation and disposal retire the pending feedback timer", () => {
  vi.useFakeTimers();
  const state = createRoot((dispose) => ({ dispose, activity: createRefreshActivity() }));
  state.activity.begin();
  state.activity.clear();
  expect(state.activity.visible()).toBe(false);
  state.activity.begin();
  state.dispose();
  expect(vi.getTimerCount()).toBe(0);
});

it("holds long requests past the minimum and ignores a cancelled predecessor's completion", async () => {
  vi.useFakeTimers();
  const state = createRoot((dispose) => ({ dispose, activity: createRefreshActivity() }));
  let finish!: () => void;
  const first = state.activity.begin();
  state.activity.track(
    first,
    new Promise<void>((done) => {
      finish = done;
    }),
  );
  vi.advanceTimersByTime(1000);
  expect(state.activity.visible()).toBe(false);
  expect(state.activity.pending()).toBe(true);
  state.activity.clear();
  expect(first.aborted).toBe(true);
  expect(state.activity.pending()).toBe(false);
  const second = state.activity.begin();
  let reject!: (failure: Error) => void;
  state.activity.track(
    second,
    new Promise((_done, fail) => {
      reject = fail;
    }),
  );
  finish();
  await Promise.resolve();
  expect(state.activity.pending()).toBe(true);
  reject(Error("Unavailable"));
  await Promise.resolve();
  expect(state.activity.pending()).toBe(false);
  expect(state.activity.visible()).toBe(true);
  vi.advanceTimersByTime(1000);
  expect(state.activity.visible()).toBe(false);
  expect(second.aborted).toBe(false);
  state.dispose();
  expect(second.aborted).toBe(true);
});

it("retires old-owner feedback and a pending promise without touching a successor", async () => {
  vi.useFakeTimers();
  const firstOwner = {},
    secondOwner = {};
  const [owner, setOwner] = createSignal(firstOwner);
  const state = createRoot((dispose) => ({ dispose, activity: createRefreshActivity(owner) }));
  let finishOld!: () => void;
  const old = state.activity.begin();
  state.activity.track(
    old,
    new Promise<void>((done) => {
      finishOld = done;
    }),
  );
  setOwner(secondOwner);
  expect(old.aborted).toBe(true);
  expect(state.activity.visible()).toBe(false);
  expect(state.activity.pending()).toBe(false);
  const fresh = state.activity.begin();
  state.activity.track(fresh, new Promise(() => {}));
  finishOld();
  await Promise.resolve();
  expect(state.activity.pending()).toBe(true);
  expect(fresh.aborted).toBe(false);
  setOwner(firstOwner);
  expect(fresh.aborted).toBe(true);
  expect(state.activity.pending()).toBe(false);
  state.dispose();
});

it("does not keep an obsolete refresh pending after a replacement query finishes", async () => {
  vi.useFakeTimers();
  const [query, setQuery] = createSignal("old");
  let oldCalls = 0,
    finish!: () => void;
  const state = createRoot((dispose) => {
    const read = createDiagnosticRead(
      () => ({ query: query() }),
      async ({ query }) => {
        if (query === "old" && ++oldCalls > 1)
          await new Promise<void>((done) => {
            finish = done;
          });
        return query;
      },
    );
    return { dispose, read, activity: createRefreshActivity(() => "same-account", read.loading) };
  });
  for (let i = 0; i < 12; i++) await Promise.resolve();
  const signal = state.activity.begin();
  const old = state.read.refetch();
  state.activity.track(signal, old);
  expect(state.read.loading()).toBe(true);
  setQuery("new");
  for (let i = 0; i < 12; i++) await Promise.resolve();
  expect(state.read.current()).toBe("new");
  expect(state.read.loading()).toBe(false);
  vi.advanceTimersByTime(1000);
  expect(state.activity.visible()).toBe(false);
  expect(state.activity.pending()).toBe(false);
  finish();
  await old;
  expect(state.read.current()).toBe("new");
  state.dispose();
});

it("preserves the full acknowledgement when the controller completes a fast read", async () => {
  vi.useFakeTimers();
  const [busy, setBusy] = createSignal(false);
  const state = createRoot((dispose) => ({
    dispose,
    activity: createRefreshActivity(() => "owner", busy),
  }));
  const signal = state.activity.begin();
  setBusy(true);
  state.activity.track(signal, Promise.resolve());
  setBusy(false);
  await Promise.resolve();
  expect(state.activity.pending()).toBe(false);
  vi.advanceTimersByTime(999);
  expect(state.activity.visible()).toBe(true);
  vi.advanceTimersByTime(1);
  expect(state.activity.visible()).toBe(false);
  state.dispose();
});

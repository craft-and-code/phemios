import { createRoot, createSignal } from "solid-js";
import { expect, it, vi } from "vitest";
import { createPersonalReads } from "./personal-reads";
import type { AccountSession } from "./server";
import type { Section } from "../navigation/routes";
const account: AccountSession = {
  server: "http://127.0.0.1:3413",
  account: { id: "listener", username: "listener", role: "user" },
};
const settle = async () => {
  for (let i = 0; i < 8; i++) await Promise.resolve();
};
it("keeps a failed history read visible without throwing or trapping navigation", async () => {
  let dispose!: () => void;
  const request = vi.fn().mockRejectedValue(new Error("History unavailable"));
  const view = createRoot((cleanup) => {
    dispose = cleanup;
    const [section, setSection] = createSignal<Section>("history");
    const reads = createPersonalReads(
      section,
      () => account,
      () => 0,
      request,
    );
    return { ...reads, setSection };
  });
  try {
    await settle();
    expect(() => view.page()).not.toThrow();
    expect(view.page()?.error).toContain("History unavailable");
    view.setSection("favourites");
    await settle();
    expect(view.page()?.data).toBeUndefined();
    request.mockResolvedValueOnce({ items: [], total: 0 });
    view.setSection("history");
    await settle();
    expect(view.page()?.data?.items).toEqual([]);
    expect(view.page()?.error).toBeUndefined();
  } finally {
    dispose();
  }
});
it("rejects malformed pages without mounting invalid history rows", async () => {
  let dispose!: () => void;
  const request = vi.fn().mockResolvedValue({ items: null, total: 1 });
  const reads = createRoot((cleanup) => {
    dispose = cleanup;
    return createPersonalReads(
      () => "history",
      () => account,
      () => 0,
      request,
    );
  });
  try {
    await settle();
    expect(reads.page()?.error).toContain("invalide");
    expect(reads.history()).toEqual([]);
  } finally {
    dispose();
  }
});
it("retains an unavailable history track as a diagnostic and fetches no data after logout", async () => {
  let dispose!: () => void;
  const request = vi
    .fn()
    .mockResolvedValueOnce({
      items: [{ track: "track:missing", at: 100, ms_played: null, completed: null }],
      total: 1,
    })
    .mockRejectedValue(new Error("Missing"));
  const view = createRoot((cleanup) => {
    dispose = cleanup;
    const [session, setSession] = createSignal<AccountSession | undefined>(account);
    return {
      ...createPersonalReads(
        () => "history",
        session,
        () => 0,
        request,
      ),
      setSession,
    };
  });
  try {
    await settle();
    expect(view.history()?.[0]?.title).toBe("Piste indisponible");
    view.setSession(undefined);
    await settle();
    expect(view.history()).toEqual([]);
    expect(request).toHaveBeenCalledTimes(2);
  } finally {
    dispose();
  }
});

it("refreshes confirmed history while visible, preserves rows, and stops after logout", async () => {
  vi.useFakeTimers();
  let dispose!: () => void;
  let items: unknown[] = [];
  const request = vi.fn(async (path: string) =>
    path.endsWith("/history") ? { items, total: items.length } : { title: "First", release: null },
  );
  const view = createRoot((cleanup) => {
    dispose = cleanup;
    const [session, setSession] = createSignal<AccountSession | undefined>(account);
    return {
      ...createPersonalReads(
        () => "history",
        session,
        () => 0,
        request,
      ),
      setSession,
    };
  });
  try {
    await settle();
    items = [{ track: "track:first", at: 1, ms_played: 4000, completed: true }];
    await vi.advanceTimersByTimeAsync(2100);
    await settle();
    expect(view.history()[0]?.title).toBe("First");
    await vi.advanceTimersByTimeAsync(2100);
    expect(request.mock.calls.filter(([path]) => path.endsWith("/track"))).toHaveLength(1);
    view.setSession(undefined);
    await settle();
    const count = request.mock.calls.length;
    await vi.advanceTimersByTimeAsync(10000);
    expect(request).toHaveBeenCalledTimes(count);
    expect(view.history()).toEqual([]);
  } finally {
    dispose();
    vi.useRealTimers();
  }
});

it("hides the previous owner's retained history while a replacement account read is pending", async () => {
  let dispose!: () => void, complete!: (value: unknown) => void;
  let pending = false;
  const request = vi.fn(async (path: string) =>
    path.endsWith("/track")
      ? { title: "Private history", release: null }
      : pending
        ? new Promise((resolve) => {
            complete = resolve;
          })
        : { items: [{ track: "track:first", at: 1, ms_played: 1000, completed: false }], total: 1 },
  );
  const view = createRoot((cleanup) => {
    dispose = cleanup;
    const [session, setSession] = createSignal<AccountSession | undefined>(account);
    return {
      ...createPersonalReads(
        () => "history",
        session,
        () => 0,
        request,
      ),
      setSession,
    };
  });
  try {
    await settle();
    expect(view.history()[0]?.title).toBe("Private history");
    pending = true;
    view.setSession({ ...account, account: { id: "other", username: "other", role: "user" } });
    await settle();
    expect(view.history()).toEqual([]);
    complete({ items: [], total: 0 });
    await settle();
    expect(view.history()).toEqual([]);
  } finally {
    dispose();
  }
});

it("keeps settled history resident and silent throughout a pending background read", async () => {
  vi.useFakeTimers();
  let dispose!: () => void, complete!: (value: unknown) => void;
  let pending = false;
  const data = {
    items: [{ track: "track:first", at: 1, ms_played: 1000, completed: false }],
    total: 1,
  };
  const request = vi.fn(async (path: string) =>
    path.endsWith("/track")
      ? { title: "Resident", release: null }
      : pending
        ? new Promise((resolve) => {
            complete = resolve;
          })
        : data,
  );
  const reads = createRoot((cleanup) => {
    dispose = cleanup;
    return createPersonalReads(
      () => "history",
      () => account,
      () => 0,
      request,
    );
  });
  try {
    await settle();
    const row = reads.history()[0];
    pending = true;
    await vi.advanceTimersByTimeAsync(2100);
    expect(reads.loading()).toBe(false);
    expect(reads.history()[0]).toBe(row);
    complete({
      ...data,
      items: [{ track: "track:next", at: 2, ms_played: 2000, completed: true }, ...data.items],
      total: 2,
    });
    await settle();
    expect(reads.history()).toHaveLength(2);
    expect(reads.history()[1]).toBe(row);
  } finally {
    dispose();
    vi.useRealTimers();
  }
});

it("stops track resolution after logout even when the outstanding read rejects", async () => {
  let dispose!: () => void, reject!: (error: Error) => void;
  const request = vi.fn(async (path: string) =>
    path.endsWith("/history")
      ? {
          items: ["one", "two"].map((name) => ({
            track: `track:${name}`,
            at: 1,
            ms_played: null,
            completed: null,
          })),
          total: 2,
        }
      : new Promise((_resolve, fail) => {
          reject = fail;
        }),
  );
  const view = createRoot((cleanup) => {
    dispose = cleanup;
    const [session, setSession] = createSignal<AccountSession | undefined>(account);
    return {
      ...createPersonalReads(
        () => "history",
        session,
        () => 0,
        request,
      ),
      setSession,
    };
  });
  try {
    await settle();
    expect(request).toHaveBeenCalledTimes(2);
    view.setSession(undefined);
    reject(new Error("Track read interrupted"));
    await settle();
    expect(request).toHaveBeenCalledTimes(2);
    expect(view.history()).toEqual([]);
  } finally {
    dispose();
  }
});

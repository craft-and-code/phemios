import { createRoot, createSignal } from "solid-js";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createQueueSearch } from "./queue-search-controller";
const owner = {
  server: "http://fixture.invalid",
  account: { id: "owner", username: "example", role: "user" },
};
const context = () => ({
  owners: [{ source: "server" as const, session: owner }],
  albums: ["Northern Lights", "Another Morning"].map((title, i) => ({
    reference: `release:${i}`,
    title,
    artist: null,
    year: null,
    compilation: false,
    tags: [],
  })),
  artists: [],
});
const settle = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve();
};
beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());
it("retires old results immediately during typing, before the debounce admits the new search", async () => {
  let dispose!: () => void;
  const search = createRoot((cleanup) => {
    dispose = cleanup;
    return createQueueSearch(context, vi.fn());
  });
  try {
    search.chooseCategory("albums");
    await settle();
    expect(search.read.current()?.items).toHaveLength(2);
    search.setQuery("Northern");
    expect(search.waiting()).toBe(true);
    expect(search.read.current()).toBeUndefined();
    await vi.advanceTimersByTimeAsync(249);
    expect(search.read.current()).toBeUndefined();
    await vi.advanceTimersByTimeAsync(1);
    await settle();
    expect(search.read.current()?.items.map((row) => row.title)).toEqual(["Northern Lights"]);
  } finally {
    dispose();
  }
});
it("keeps Enter and category changes from leaving a timer that resets later pagination", async () => {
  let dispose!: () => void;
  const search = createRoot((cleanup) => {
    dispose = cleanup;
    return createQueueSearch(context, vi.fn());
  });
  try {
    search.chooseCategory("albums");
    search.setQuery("Northern");
    search.submit();
    search.setOffset(50);
    await vi.advanceTimersByTimeAsync(250);
    expect(search.offset()).toBe(50);
    search.setQuery("Another");
    search.chooseCategory("artists");
    search.setOffset(50);
    await vi.advanceTimersByTimeAsync(250);
    expect(search.offset()).toBe(50);
  } finally {
    dispose();
  }
});
it("ignores an older search completing after the next one and retires requests on close", async () => {
  const pending = new Map<string, (value: unknown) => void>();
  const request = vi.fn(async (_path: string, query: Record<string, string>) => {
    if (!query.q) return { items: [], total: 0, offset: 0, limit: 50, scanned_at: 1 };
    return new Promise((resolve) => pending.set(query.q!, resolve));
  });
  let dispose!: () => void;
  const search = createRoot((cleanup) => {
    dispose = cleanup;
    return createQueueSearch(context, request);
  });
  const page = (title: string) => ({
    items: [
      {
        reference: `track:${title}`,
        title,
        release: null,
        album_title: null,
        disc_no: null,
        track_no: null,
        album_position: null,
        duration_ms: null,
        analysis_available: false,
        spectrum_available: false,
      },
    ],
    total: 1,
    offset: 0,
    limit: 50,
    scanned_at: 1,
  });
  try {
    await settle();
    search.setQuery("old");
    await vi.advanceTimersByTimeAsync(250);
    search.setQuery("new");
    await vi.advanceTimersByTimeAsync(250);
    pending.get("new")!(page("new"));
    await settle();
    expect(search.read.current()?.items[0]?.title).toBe("new");
    pending.get("old")!(page("old"));
    await settle();
    expect(search.read.current()?.items[0]?.title).toBe("new");
    search.setQuery("closed");
    await vi.advanceTimersByTimeAsync(250);
    dispose();
    pending.get("closed")!(page("closed"));
    await settle();
    expect(search.read.current()).toBeUndefined();
  } finally {
    dispose();
  }
});

it("hides old-account collections immediately and refuses their late response after account replacement", async () => {
  const [session, setSession] = createSignal<typeof owner | undefined>(owner);
  let releaseOld!: (value: unknown) => void, dispose!: () => void;
  const search = createRoot((cleanup) => {
    dispose = cleanup;
    return createQueueSearch(
      () => ({
        ...context(),
        owners: session() ? [{ source: "server" as const, session: session()! }] : [],
      }),
      async (path, _query, _source, account) => {
        if (!path.endsWith("collections"))
          return { items: [], total: 0, offset: 0, limit: 50, scanned_at: 1 };
        if (account === owner)
          return new Promise((resolve) => {
            releaseOld = resolve;
          });
        return { items: [{ name: "New private", expression: "*" }], total: 1, offset: 0 };
      },
    );
  });
  try {
    search.chooseCategory("collections");
    await settle();
    setSession({ ...owner, account: { ...owner.account, id: "next" } });
    expect(search.read.current()).toBeUndefined();
    await settle();
    expect(search.read.current()?.items.map((row) => row.title)).toEqual(["New private"]);
    releaseOld({ items: [{ name: "Old private", expression: "*" }], total: 1, offset: 0 });
    await settle();
    expect(search.read.current()?.items.map((row) => row.title)).toEqual(["New private"]);
    setSession(undefined);
    expect(search.read.current()).toBeUndefined();
  } finally {
    dispose();
  }
});

it("resets a previous result page when typing the numeric album title 13 and keeps it through Enter", async () => {
  let dispose!: () => void;
  const request = vi.fn();
  const search = createRoot((cleanup) => {
    dispose = cleanup;
    return createQueueSearch(
      () => ({
        ...context(),
        albums: [
          {
            reference: "release:numeric",
            title: "13",
            artist: null,
            year: 2012,
            compilation: false,
            tags: [],
          },
        ],
      }),
      request,
    );
  });
  try {
    search.chooseCategory("albums");
    await settle();
    request.mockClear();
    search.setOffset(50);
    search.setQuery("13");
    await vi.advanceTimersByTimeAsync(250);
    await settle();
    expect(search.offset()).toBe(0);
    expect(search.read.current()?.items.map((row) => row.title)).toEqual(["13"]);
    search.submit();
    await settle();
    expect(search.read.current()?.items.map((row) => row.reference)).toEqual(["release:numeric"]);
    expect(request).not.toHaveBeenCalled();
  } finally {
    dispose();
  }
});

it("finds numeric cached albums without a connected account while keeping private categories inactive", async () => {
  let dispose!: () => void;
  const request = vi.fn();
  const search = createRoot((cleanup) => {
    dispose = cleanup;
    return createQueueSearch(
      () => ({
        ...context(),
        owners: [],
        albums: [
          {
            reference: "release:numeric",
            title: "13",
            artist: null,
            year: 2012,
            compilation: false,
            tags: [],
          },
        ],
      }),
      request,
    );
  });
  try {
    search.chooseCategory("albums");
    search.setQuery("13");
    await vi.advanceTimersByTimeAsync(250);
    await settle();
    expect(search.read.current()?.items.map((row) => row.title)).toEqual(["13"]);
    search.chooseCategory("collections");
    await settle();
    expect(search.read.current()).toBeUndefined();
    expect(request).not.toHaveBeenCalled();
  } finally {
    dispose();
  }
});

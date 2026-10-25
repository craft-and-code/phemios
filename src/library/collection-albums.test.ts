import { createRoot, createSignal } from "solid-js";
import { beforeEach, expect, it, vi } from "vitest";
import { createCollectionAlbums, type CollectionAlbumScope } from "./collection-albums";
import { requestAede } from "../platform/desktop";
import { demoAlbums, demoArtists } from "../demo/catalog";
import { diagnosticOwner } from "./diagnostic-read-test-fixtures";
import { filterAlbums } from "./filtering";
vi.mock("../platform/desktop", () => ({ requestAede: vi.fn() }));
const settle = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve();
};
const scope = (): CollectionAlbumScope => ({
  name: "Jazz",
  id: `collection-${"1".repeat(64)}`,
  session: diagnosticOwner("fixture"),
  source: "local",
  albums: demoAlbums,
});
beforeEach(() => {
  vi.mocked(requestAede).mockReset();
});

it("requests the immutable target and keeps all album filters within the admitted subset", async () => {
  const held = scope(),
    selected = demoAlbums.slice(0, 2);
  vi.mocked(requestAede).mockResolvedValue({ items: selected.map((album) => album.reference) });
  let dispose!: () => void;
  const read = createRoot((cleanup) => {
    dispose = cleanup;
    return createCollectionAlbums(() => held);
  });
  try {
    expect(read.loading()).toBe(true);
    await settle();
    expect(requestAede).toHaveBeenCalledWith(
      "/api/me/v1/collection/albums",
      { id: held.id },
      "GET",
      null,
      "local",
      held.session,
    );
    expect(read.current()).toEqual(selected);
    const filters = {
      mode: "none" as const,
      years: [0, 9999] as const,
      alphabet: [0, 26] as const,
      includeUnknownYear: true,
      query: "",
    };
    expect(filterAlbums(read.current()!, demoArtists, filters)).toEqual(selected);
    expect(
      filterAlbums(read.current()!, demoArtists, { ...filters, query: "No such album" }),
    ).toEqual([]);
    expect(read.current()).toHaveLength(2);
    expect(read.current()?.length).toBeLessThan(demoAlbums.length);
  } finally {
    dispose();
  }
});

it.each([{ items: null }, { items: [17] }, { items: ["album:unknown"] }])(
  "refuses malformed or stale references instead of showing the full catalog: %j",
  async (response) => {
    const held = scope();
    vi.mocked(requestAede).mockResolvedValue(response);
    let dispose!: () => void;
    const read = createRoot((cleanup) => {
      dispose = cleanup;
      return createCollectionAlbums(() => held);
    });
    try {
      await settle();
      expect(read.current()).toBeUndefined();
      expect(read.error()).not.toBe("");
      expect(read.loading()).toBe(false);
    } finally {
      dispose();
    }
  },
);

it("retires old target, source, account and catalog answers without accepting a same-name replacement", async () => {
  const first = scope();
  const [held, setHeld] = createSignal<CollectionAlbumScope | false>(first);
  const late: ((value: unknown) => void)[] = [];
  vi.mocked(requestAede).mockImplementation(
    () => new Promise((resolve) => late.push(resolve)) as ReturnType<typeof requestAede>,
  );
  let dispose!: () => void;
  const read = createRoot((cleanup) => {
    dispose = cleanup;
    return createCollectionAlbums(held);
  });
  try {
    setHeld({ ...first, id: `collection-${"2".repeat(64)}` });
    setHeld({ ...first, source: "server" });
    setHeld({ ...first, session: diagnosticOwner("replacement") });
    setHeld({ ...first, albums: [...demoAlbums] });
    expect(read.loading()).toBe(true);
    expect(late).toHaveLength(5);
    late[4]!({ items: [demoAlbums[1]!.reference] });
    await settle();
    expect(read.current()).toEqual([demoAlbums[1]]);
    for (const resolve of late.slice(0, 4)) resolve({ items: [demoAlbums[0]!.reference] });
    await settle();
    expect(read.current()).toEqual([demoAlbums[1]]);
    setHeld(false);
    expect(read.current()).toBeUndefined();
    expect(read.loading()).toBe(false);
    expect(read.error()).toBe("");
  } finally {
    dispose();
  }
});

it("keeps errors explicit, retries with the captured owner and retires disposed reads", async () => {
  const held = scope();
  vi.mocked(requestAede)
    .mockRejectedValueOnce(new Error("Unavailable"))
    .mockResolvedValueOnce({ items: [] });
  let dispose!: () => void;
  const read = createRoot((cleanup) => {
    dispose = cleanup;
    return createCollectionAlbums(() => held);
  });
  await settle();
  expect(read.error()).toBe("Unavailable");
  await read.refetch();
  await settle();
  expect(read.current()).toEqual([]);
  expect(read.error()).toBe("");
  expect(vi.mocked(requestAede).mock.calls[1]?.[5]).toBe(held.session);
  dispose();
  let resolve!: (value: unknown) => void;
  vi.mocked(requestAede).mockImplementationOnce(
    () =>
      new Promise((done) => {
        resolve = done;
      }) as ReturnType<typeof requestAede>,
  );
  const retired = createRoot((cleanup) => {
    dispose = cleanup;
    return createCollectionAlbums(() => held);
  });
  dispose();
  resolve({ items: [demoAlbums[0]!.reference] });
  await settle();
  expect(retired.current()).toBeUndefined();
  expect(retired.loading()).toBe(false);
});

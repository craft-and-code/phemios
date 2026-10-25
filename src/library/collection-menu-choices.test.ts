import { expect, it, vi } from "vitest";
import { readCollectionMenuChoices } from "./collection-menu-choices";
import { requestAede } from "../platform/desktop";
import type { AccountSession } from "./server";
vi.mock("../platform/desktop", () => ({ requestAede: vi.fn() }));
const owner: AccountSession = {
  server: "https://catalog.example",
  account: { id: "reader", username: "reader", role: "user" },
};
const page = (offset: number, total: number) => ({
  offset,
  limit: 50,
  total,
  scanned_at: 7,
  items: Array.from({ length: Math.min(50, total - offset) }, (_, i) => ({
    id: `collection-${(offset + i).toString(16).padStart(64, "0")}`,
    name: `Collection ${offset + i}`,
    expression: "genre:Jazz",
  })),
});
it("reads all pages from the captured owner/source without copying expressions into menu choices", async () => {
  vi.mocked(requestAede)
    .mockReset()
    .mockResolvedValueOnce(page(0, 51))
    .mockResolvedValueOnce(page(50, 51));
  const names = await readCollectionMenuChoices("local", owner, () => true);
  expect(names).toHaveLength(51);
  expect(names?.at(-1)).toBe("Collection 50");
  expect(requestAede).toHaveBeenLastCalledWith(
    "/api/me/v1/collections",
    { offset: "50", limit: "50" },
    "GET",
    null,
    "local",
    owner,
  );
});
it("never continues pagination after its initiating login is retired", async () => {
  let current = true;
  vi.mocked(requestAede)
    .mockReset()
    .mockImplementationOnce(async () => {
      current = false;
      return page(0, 51);
    });
  expect(await readCollectionMenuChoices("server", owner, () => current)).toBeUndefined();
  expect(requestAede).toHaveBeenCalledOnce();
});
it("refuses malformed, changed, duplicate and unbounded pages instead of offering incomplete choices", async () => {
  for (const bad of [
    { ...page(0, 1), items: [{ name: 42 }] },
    { ...page(0, 1), offset: 1 },
    { ...page(0, 1), total: 5000 },
    { ...page(0, 2), items: [{ name: "Repeated" }, { name: "Repeated" }] },
  ]) {
    vi.mocked(requestAede).mockReset().mockResolvedValueOnce(bad);
    await expect(readCollectionMenuChoices("server", owner, () => true)).rejects.toThrow();
  }
  vi.mocked(requestAede)
    .mockReset()
    .mockResolvedValueOnce(page(0, 51))
    .mockResolvedValueOnce({ ...page(50, 51), total: 52 });
  await expect(readCollectionMenuChoices("server", owner, () => true)).rejects.toThrow();
});

it("retires a delayed collection list across replacement login, logout and disposal", async () => {
  const { createRoot, createSignal } = await import("solid-js");
  const { createCollectionMenuChoices } = await import("./collection-menu-choices");
  const settle = async () => {
    for (let i = 0; i < 12; i++) await Promise.resolve();
  };
  let resolve!: (value: unknown) => void;
  const late = new Promise<unknown>((yes) => {
    resolve = yes;
  });
  const replacement = { ...owner, account: { ...owner.account, id: "replacement" } };
  const [session, setSession] = createSignal<AccountSession | undefined>(owner);
  vi.mocked(requestAede)
    .mockReset()
    .mockReturnValueOnce(late)
    .mockResolvedValueOnce({
      ...page(0, 1),
      items: [{ id: `collection-${"f".repeat(64)}`, name: "Replacement collection" }],
    });
  let dispose!: () => void;
  const read = createRoot((cleanup) => {
    dispose = cleanup;
    return createCollectionMenuChoices(() => {
      const held = session();
      return held ? { source: "server", session: held } : false;
    });
  });
  try {
    await settle();
    setSession(replacement);
    await settle();
    expect(read.names()).toEqual(["Replacement collection"]);
    resolve(page(0, 51));
    await settle();
    expect(read.names()).toEqual(["Replacement collection"]);
    expect(requestAede).toHaveBeenCalledTimes(2);
    expect(vi.mocked(requestAede).mock.calls[1]?.[5]).toBe(replacement);
    setSession(undefined);
    expect(read.names()).toEqual([]);
    expect(read.identity()).toBe(false);
  } finally {
    dispose();
  }
  expect(read.names()).toEqual([]);
});

it("requires stable server IDs and rejects duplicate IDs even when names differ", async () => {
  for (const items of [
    [{ name: "Old server" }],
    [
      { id: `collection-${"a".repeat(64)}`, name: "One" },
      { id: `collection-${"a".repeat(64)}`, name: "Two" },
    ],
  ]) {
    vi.mocked(requestAede)
      .mockReset()
      .mockResolvedValueOnce({ ...page(0, items.length), items });
    await expect(readCollectionMenuChoices("local", owner, () => true)).rejects.toThrow();
  }
});

it("retires a listing already in flight when a rename invalidates the directory", async () => {
  const { createRoot } = await import("solid-js");
  const { createCollectionMenuChoices } = await import("./collection-menu-choices");
  const settle = async () => {
    for (let i = 0; i < 12; i++) await Promise.resolve();
  };
  let finish!: (value: unknown) => void;
  vi.mocked(requestAede)
    .mockReset()
    .mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      }),
    )
    .mockResolvedValueOnce({
      ...page(0, 1),
      items: [{ id: `collection-${"a".repeat(64)}`, name: "Renamed" }],
    });
  let dispose!: () => void;
  const scope = { source: "local" as const, session: owner };
  const directory = createRoot((cleanup) => {
    dispose = cleanup;
    return createCollectionMenuChoices(() => scope);
  });
  try {
    await settle();
    expect(directory.loading()).toBe(true);
    directory.refresh();
    await settle();
    expect(directory.identity()).toBe(scope);
    expect(directory.names()).toEqual(["Renamed"]);
    finish(page(0, 1));
    await settle();
    expect(directory.names()).toEqual(["Renamed"]);
    expect(requestAede).toHaveBeenCalledTimes(2);
  } finally {
    dispose();
  }
});

import {
  createComponent,
  createMemo,
  createRoot,
  createSignal,
  Suspense,
  type JSX,
} from "solid-js";
import { expect, it, vi } from "vitest";
import { createM3UBrowser, type M3UScope } from "./m3u-browser";
const id = `m3u-file-${"a".repeat(64)}`;
const owner = {
  server: "https://music.example",
  account: { id: "listener-one", username: "listener", role: "user" },
};
const initial: M3UScope = {
  session: owner,
  source: "server",
  kind: "files",
  query: "artist",
  offset: 0,
};
const page = {
  items: [
    {
      id,
      name: "Artist collection",
      filename: "mix.m3u",
      path: "/music/mix.m3u",
      track_count: null,
    },
  ],
  total: 1,
  offset: 0,
  unavailable_roots: 0,
  unreadable_directories: 0,
};
const file = {
  ...page.items[0],
  id,
  filename: "mix.m3u",
  content: "one.flac\r\ntwo.mp3\r\n",
  track_count: 2,
};
const status = { capabilities: ["library_m3u_files"] };
const settle = async () => {
  for (let i = 0; i < 20; i++) await Promise.resolve();
};
function mount(request: Parameters<typeof createM3UBrowser>[1]) {
  const [scope, setScope] = createSignal<M3UScope | undefined>(initial);
  let dispose!: () => void;
  const read = createRoot((cleanup) => {
    dispose = cleanup;
    return createM3UBrowser(createMemo(scope), request);
  });
  return { read, setScope, dispose };
}
it("lists metadata and searches every folder before reading only the explicit selected file", async () => {
  const request = vi.fn(async (path: string) =>
    path.endsWith("status") ? status : path.endsWith(id) ? file : page,
  );
  const { read, dispose } = mount(request);
  await settle();
  expect(read.page()?.items).toHaveLength(1);
  expect(request).toHaveBeenNthCalledWith(
    2,
    "/api/me/v1/m3u-files",
    { offset: "0", limit: "50", q: "artist" },
    "server",
  );
  expect(request).toHaveBeenCalledTimes(2);
  read.select(id);
  await settle();
  expect(read.detail()?.titles).toEqual(["one.flac", "two.mp3"]);
  expect(read.detail()?.source).toBe("server");
  dispose();
});
it("contains failed detail reads and supports a local retry without dropping the file list", async () => {
  let failed = true;
  const { read, dispose } = mount(async (path) => {
    if (path.endsWith("status")) return status;
    if (path.endsWith(id)) {
      if (failed) throw Error("File temporarily offline");
      return file;
    }
    return page;
  });
  await settle();
  read.select(id);
  await settle();
  expect(() => read.detail()).not.toThrow();
  expect(read.detailError()).toContain("offline");
  expect(read.page()?.total).toBe(1);
  failed = false;
  await read.retryDetail();
  await settle();
  expect(read.detailError()).toBe("");
  expect(read.detail()?.id).toBe(id);
  dispose();
});
it("hides selected data immediately and discards late detail after source or account replacement", async () => {
  let finish!: (value: unknown) => void;
  const { read, setScope, dispose } = mount(async (path) =>
    path.endsWith("status")
      ? status
      : path.endsWith(id)
        ? new Promise((resolve) => {
            finish = resolve;
          })
        : page,
  );
  await settle();
  read.select(id);
  await settle();
  setScope({
    ...initial,
    source: "local",
    session: { ...owner, account: { ...owner.account, id: "listener-two" } },
  });
  expect(read.detail()).toBeUndefined();
  expect(read.selected()).toBe("");
  finish(file);
  await settle();
  expect(read.detail()).toBeUndefined();
  expect(read.detailError()).toBe("");
  setScope(undefined);
  expect(read.page()).toBeUndefined();
  expect(read.error()).toBe("");
  dispose();
});
it("keeps malformed pages recoverable and blocks unsupported folder APIs before enumeration", async () => {
  let malformed = true;
  const { read, dispose } = mount(async (path) =>
    path.endsWith("status") ? status : malformed ? { ...page, offset: 50 } : page,
  );
  await settle();
  expect(() => read.page()).not.toThrow();
  expect(read.error()).not.toBe("");
  malformed = false;
  await read.refetch();
  await settle();
  expect(read.error()).toBe("");
  expect(read.page()?.total).toBe(1);
  dispose();
  const request = vi.fn(async () => ({ capabilities: [] }));
  const unsupported = mount(request);
  await settle();
  expect(unsupported.read.error()).toContain("Aède");
  expect(request).toHaveBeenCalledTimes(1);
  unsupported.dispose();
});
it("stops admission and further enumeration after disposal during the capability read", async () => {
  let finish!: (value: unknown) => void;
  const request = vi.fn(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const { read, dispose } = mount(request);
  dispose();
  finish(status);
  await settle();
  expect(request).toHaveBeenCalledTimes(1);
  expect(read.page()).toBeUndefined();
  expect(read.loading()).toBe(false);
});

it("refreshes capabilities after updating the same server without requiring reconnection", async () => {
  let modern = false;
  const { read, dispose } = mount(async (path) =>
    path.endsWith("status") ? { capabilities: modern ? ["library_m3u_files"] : [] } : page,
  );
  await settle();
  expect(read.error()).not.toBe("");
  modern = true;
  await read.refetch();
  await settle();
  expect(read.error()).toBe("");
  expect(read.page()?.total).toBe(1);
  dispose();
});

it("admits a download acknowledgement only for the same owner, category, query, page and selected file", async () => {
  const { read, setScope, dispose } = mount(async (path) =>
    path.endsWith("status") ? status : path.endsWith(id) ? file : page,
  );
  await settle();
  read.select(id);
  await settle();
  expect(read.isCurrentFile(initial, id)).toBe(true);
  expect(read.isCurrentFile(initial, `m3u-file-${"b".repeat(64)}`)).toBe(false);
  for (const change of [
    { query: "another" },
    { offset: 50 },
    { kind: "exports" as const },
    { source: "local" as const },
  ]) {
    setScope({ ...initial, ...change });
    expect(read.isCurrentFile(initial, id)).toBe(false);
    await settle();
    setScope(initial);
    await settle();
    read.select(id);
    await settle();
  }
  dispose();
  expect(read.isCurrentFile(initial, id)).toBe(false);
});

it("keeps the workspace mounted while only the selected M3U content loads", async () => {
  let reply!: (value: unknown) => void;
  let dispose!: () => void;
  let read!: ReturnType<typeof createM3UBrowser>;
  const view = createRoot((cleanup) => {
    dispose = cleanup;
    return createComponent(Suspense, {
      fallback: "whole-page-loader",
      get children() {
        read = createM3UBrowser(
          () => initial,
          async (path) =>
            path.endsWith("status")
              ? status
              : path.endsWith(id)
                ? new Promise((resolve) => {
                    reply = resolve;
                  })
                : page,
        );
        return createMemo(
          () => `${read.page()?.total ?? 0}:${read.detail()?.id ?? "content-loader"}`,
        ) as unknown as JSX.Element;
      },
    });
  });
  const rendered = () => {
    let value: unknown = view;
    while (typeof value === "function") value = value();
    return value;
  };
  await settle();
  read.select(id);
  await settle();
  expect(rendered()).toBe("1:content-loader");
  reply(file);
  await settle();
  expect(rendered()).toBe(`1:${id}`);
  dispose();
});

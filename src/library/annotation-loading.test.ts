import { expect, it, vi } from "vitest";
import { createAnnotationLoader } from "./annotation-loading";
import { referenceSource, type SourceId } from "./sources";
import type { AccountSession, Annotation } from "./server";
const owner = (server: string): AccountSession => ({
  server,
  account: { id: "same-id", username: "listener", role: "user" },
});
const annotation = (reference: string, tag: string): Annotation => ({
  reference,
  loved: false,
  rating: null,
  note: null,
  tags: [tag],
});
const page = (rows: Annotation[], total = rows.length, offset = 0) => ({
  items: rows,
  total,
  offset,
  limit: 200,
  scanned_at: 1,
});
function setup(request: (source: SourceId, offset: number) => Promise<unknown>) {
  const sessions: Record<SourceId, AccountSession | undefined> = {
    local: owner("local"),
    server: owner("https://first.example"),
  };
  const rows = new Map<string, Annotation>();
  const error = vi.fn();
  const loader = createAnnotationLoader({
    session: (source) => sessions[source],
    request,
    error,
    clear: (source) => {
      for (const key of rows.keys()) if (referenceSource(key) === source) rows.delete(key);
    },
    publish: (_source, values) => {
      for (const row of values) rows.set(row.reference, row);
    },
  });
  return { sessions, rows, error, loader };
}
it("clears only the replaced source and ignores old pages even when another authority has the same account id", async () => {
  let finish!: (value: unknown) => void;
  const target = setup(
    async () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  target.rows.set("artist:old", annotation("artist:old", "private"));
  target.rows.set("artist:@phemios/local/kept", annotation("artist:@phemios/local/kept", "local"));
  const read = target.loader.load("server");
  target.sessions.server = owner("https://second.example");
  target.loader.reset("server");
  expect([...target.rows.keys()]).toEqual(["artist:@phemios/local/kept"]);
  finish(page([annotation("artist:late", "old private tag")]));
  await read;
  expect([...target.rows.keys()]).toEqual(["artist:@phemios/local/kept"]);
  expect(target.error).not.toHaveBeenCalled();
});
it("replaces a complete source projection after validated paging while keeping confirmed concurrent edits", async () => {
  let finish!: (value: unknown) => void;
  const target = setup(async (_source, offset) =>
    offset
      ? new Promise((resolve) => {
          finish = resolve;
        })
      : page([annotation("artist:new", "snapshot")], 2),
  );
  target.rows.set("artist:deleted", annotation("artist:deleted", "old"));
  const read = target.loader.load("server");
  await Promise.resolve();
  expect([...target.rows.keys()]).toEqual(["artist:deleted"]);
  const saved = annotation("artist:new", "confirmed edit");
  target.rows.set(saved.reference, saved);
  target.loader.updated(saved.reference, saved);
  finish(page([annotation("release:other", "new")], 2, 1));
  await read;
  expect([...target.rows.keys()]).toEqual(["artist:new", "release:other"]);
  expect(target.rows.get(saved.reference)?.tags).toEqual(["confirmed edit"]);
});
it("retains the old projection and reports malformed cross-source or duplicate page data", async () => {
  for (const malformed of [
    page([annotation("artist:@phemios/local/wrong", "foreign")]),
    page([annotation("artist:same", "one"), annotation("artist:same", "two")]),
    { ...page([]), total: -1 },
  ]) {
    const target = setup(async () => malformed);
    target.rows.set("artist:previous", annotation("artist:previous", "keep"));
    await target.loader.load("server");
    expect([...target.rows.keys()]).toEqual(["artist:previous"]);
    expect(target.error).toHaveBeenCalledOnce();
  }
});
it("discards errors after application disposal", async () => {
  let reject!: (value: unknown) => void;
  const target = setup(
    async () =>
      new Promise((_resolve, fail) => {
        reject = fail;
      }),
  );
  const read = target.loader.load("server");
  target.loader.dispose();
  reject(new Error("Old account error"));
  await read;
  expect(target.error).not.toHaveBeenCalled();
});

it("discards replaced authority results without relying on a reset call or a changed account id", async () => {
  let finish!: (value: unknown) => void;
  const target = setup(
    async () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const read = target.loader.load("server");
  target.sessions.server = owner("https://second.example");
  finish(page([annotation("artist:late", "old private tag")]));
  await read;
  expect(target.rows.size).toBe(0);
  expect(target.error).not.toHaveBeenCalled();
});
it("keeps a newer snapshot when an older read completes or fails afterwards", async () => {
  for (const fails of [false, true]) {
    let finish!: (value: unknown) => void,
      reject!: (value: unknown) => void,
      calls = 0;
    const target = setup(async () =>
      calls++ === 0
        ? new Promise((resolve, fail) => {
            finish = resolve;
            reject = fail;
          })
        : page([annotation("artist:new", "current")]),
    );
    const older = target.loader.load("server");
    await target.loader.load("server");
    if (fails) reject(new Error("Stale owner failure"));
    else finish(page([annotation("artist:old", "stale")]));
    await older;
    expect([...target.rows.keys()]).toEqual(["artist:new"]);
    expect(target.error).not.toHaveBeenCalled();
  }
});

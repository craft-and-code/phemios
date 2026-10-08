import { createRoot, createSignal } from "solid-js";
import { it, expect } from "vitest";
import { createTrackPaging } from "./track-paging";
it("retains the current page across detail visits and resets on search or session changes", async () => {
  let dispose = () => {},
    query!: (v: string) => void,
    session!: (v: string) => void,
    paging!: ReturnType<typeof createTrackPaging>;
  createRoot((clean) => {
    dispose = clean;
    const [q, setQ] = createSignal(""),
      [s, setS] = createSignal("one");
    query = setQ;
    session = setS;
    paging = createTrackPaging(q, s);
  });
  await Promise.resolve();
  paging.setOffset(50);
  let childDispose = () => {};
  createRoot((clean) => {
    childDispose = clean;
    expect(paging.offset()).toBe(50);
  });
  childDispose();
  expect(paging.offset()).toBe(50);
  query("solo");
  await Promise.resolve();
  expect(paging.offset()).toBe(0);
  paging.setOffset(100);
  session("two");
  await Promise.resolve();
  expect(paging.offset()).toBe(0);
  expect(() => paging.setOffset(-50)).toThrow();
  expect(() => paging.setOffset(51)).toThrow();
  dispose();
});

it("does not discard the track window when unrelated catalog facets change", async () => {
  let dispose = () => {},
    change!: () => void,
    paging!: ReturnType<typeof createTrackPaging>;
  createRoot((clean) => {
    dispose = clean;
    const [filters, set] = createSignal({ query: "", years: 1990 });
    change = () => set({ query: "", years: 2000 });
    paging = createTrackPaging(
      () => filters().query,
      () => "session",
    );
  });
  await Promise.resolve();
  paging.setOffset(50);
  change();
  await Promise.resolve();
  expect(paging.offset()).toBe(50);
  dispose();
});

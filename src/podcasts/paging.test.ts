import { createRoot, createSignal } from "solid-js";
import { expect, it } from "vitest";
import { createEpisodePaging } from "./paging";
import { feed } from "./test-fixtures";
const episodes = Array.from({ length: 63 }, (_, index) => ({
  ...feed.episodes[0]!,
  id: String(index),
}));
it("renders bounded local windows and retains the final partial page", () => {
  createRoot((dispose) => {
    const paging = createEpisodePaging(
      () => episodes,
      () => "owner/feed/query",
    );
    expect(paging.rows().length).toBe(25);
    expect(paging.rows()[0]?.id).toBe("0");
    paging.select(25);
    expect(paging.rows()[0]?.id).toBe("25");
    paging.select(50);
    expect(paging.rows().length).toBe(13);
    expect(paging.total()).toBe(63);
    dispose();
  });
});
it("retires the selected page on account, feed or search replacement", () => {
  const state = createRoot((dispose) => {
    const [scope, change] = createSignal<unknown>({});
    return { dispose, change, paging: createEpisodePaging(() => episodes, scope) };
  });
  try {
    for (let i = 0; i < 3; i++) {
      state.paging.select(25);
      state.change({});
      expect(state.paging.offset()).toBe(0);
    }
  } finally {
    state.dispose();
  }
});
it("clamps the offset after refresh shrinks the feed and ignores malformed offsets", () => {
  const state = createRoot((dispose) => {
    const [rows, change] = createSignal(episodes);
    return { dispose, change, paging: createEpisodePaging(rows, () => "owner") };
  });
  try {
    state.paging.select(50);
    state.change(episodes.slice(0, 30));
    expect(state.paging.offset()).toBe(25);
    expect(state.paging.rows().length).toBe(5);
    state.paging.select(-1);
    state.paging.select(Number.NaN);
    state.paging.select(10);
    expect(state.paging.offset()).toBe(25);
    state.change([]);
    expect(state.paging.offset()).toBe(0);
    expect(state.paging.rows()).toEqual([]);
  } finally {
    state.dispose();
  }
});

import { createRoot, createSignal } from "solid-js";
import { expect, it } from "vitest";
import { createRetainedSearch } from "./retained-search";
it("keeps a submitted form and confirmed window after its first consumer is disposed", () => {
  let dispose = () => {};
  const state = createRoot((end) => {
    dispose = end;
    return createRetainedSearch(() => "alice-session");
  });
  state.setCriteria((old) => ({ ...old, text: { artist: "Echo" } }));
  state.setSubmitted({ expression: "artist:Echo" });
  state.setOffset(50);
  const result = { items: [], total: 51, unavailable: [] };
  state.remember(state.scope(), "artist:Echo", 50, result);
  createRoot((end) => {
    expect(state.cached("artist:Echo", 50)).toBe(result);
    end();
  });
  createRoot((end) => {
    expect(state.criteria().text.artist).toBe("Echo");
    expect(state.submitted()?.expression).toBe("artist:Echo");
    expect(state.offset()).toBe(50);
    expect(state.cached("artist:Echo", 50)).toBe(result);
    end();
  });
  dispose();
});
it("clears the private form on account/session/epoch replacement and rejects late windows", () => {
  let dispose = () => {};
  const model = createRoot((end) => {
    dispose = end;
    const [scope, setScope] = createSignal("alice:session1:epoch1");
    return { setScope, state: createRetainedSearch(scope) };
  });
  const state = model.state;
  state.setCriteria((old) => ({ ...old, text: { note: "private" } }));
  state.setSubmitted({ expression: "note:private" });
  state.setOffset(50);
  state.remember(state.scope(), "note:private", 50, { items: [], total: 9, unavailable: [] });
  model.setScope("bob:session1:epoch1");
  expect(state.cached("note:private", 50)).toBeUndefined();
  expect(state.criteria().text).toEqual({});
  expect(state.submitted()).toBeUndefined();
  expect(state.offset()).toBe(0);
  state.remember("alice:session1:epoch1", "note:private", 50, {
    items: [],
    total: 99,
    unavailable: [],
  });
  expect(state.cached("note:private", 50)).toBeUndefined();
  model.setScope("alice:session2:epoch1");
  expect(state.cached("note:private", 50)).toBeUndefined();
  dispose();
});

it("explicitly resubmits the same query with a fresh window while route consumers retain confirmed data", () => {
  createRoot((dispose) => {
    const state = createRetainedSearch(() => "alice:session1:epoch1");
    state.setCriteria((old) => ({ ...old, text: { artist: "Echo" } }));
    state.setSubmitted({ expression: "artist:Echo" });
    const first = { items: [], total: 1, unavailable: [] };
    state.remember(state.scope(), "artist:Echo", 0, first);
    createRoot((end) => {
      expect(state.cached("artist:Echo", 0)).toBe(first);
      end();
    });
    state.submit("artist:Echo");
    expect(state.criteria().text.artist).toBe("Echo");
    expect(state.cached("artist:Echo", 0)).toBeUndefined();
    expect(state.submitted()?.expression).toBe("artist:Echo");
    const refreshed = { items: [], total: 2, unavailable: [] };
    state.remember(state.scope(), "artist:Echo", 0, refreshed);
    expect(state.cached("artist:Echo", 0)).toBe(refreshed);
    state.reset();
    expect(state.cached("artist:Echo", 0)).toBeUndefined();
    expect(state.criteria().text).toEqual({});
    dispose();
  });
});
it("keeps the form when a public snapshot recomputes an identical owner/session/epoch key", () => {
  let dispose = () => {};
  const view = createRoot((end) => {
    dispose = end;
    const [snapshot, setSnapshot] = createSignal({ owner: "alice", session: 1, epoch: 42 });
    const state = createRetainedSearch(() => JSON.stringify(snapshot()));
    return { state, setSnapshot };
  });
  view.state.setCriteria((old) => ({ ...old, text: { tag: "music" } }));
  view.state.setSubmitted({ expression: "tag:music" });
  const result = { items: [], total: 1, unavailable: [] };
  view.state.remember(view.state.scope(), "tag:music", 0, result);
  view.setSnapshot({ owner: "alice", session: 1, epoch: 42 });
  expect(view.state.criteria().text.tag).toBe("music");
  expect(view.state.cached("tag:music", 0)).toBe(result);
  view.setSnapshot({ owner: "alice", session: 1, epoch: 43 });
  expect(view.state.criteria().text).toEqual({});
  expect(view.state.cached("tag:music", 0)).toBeUndefined();
  dispose();
});
it("refuses an earlier query or page completing after the currently confirmed selection", () => {
  createRoot((dispose) => {
    const state = createRetainedSearch(() => "alice:session1:epoch1");
    state.setSubmitted({ expression: "artist:Alpha" });
    const scope = state.scope();
    state.setSubmitted({ expression: "artist:Beta" });
    const latest = { items: [], total: 2, unavailable: [] };
    state.remember(scope, "artist:Beta", 0, latest);
    state.remember(scope, "artist:Alpha", 0, { items: [], total: 1, unavailable: [] });
    expect(state.cached("artist:Beta", 0)).toBe(latest);
    state.setOffset(50);
    const page = { items: [], total: 52, unavailable: [] };
    state.remember(scope, "artist:Beta", 50, page);
    state.remember(scope, "artist:Beta", 0, latest);
    expect(state.cached("artist:Beta", 50)).toBe(page);
    dispose();
  });
});

it("refuses an old request completing after an explicit refresh of identical criteria", () => {
  createRoot((dispose) => {
    const state = createRetainedSearch(() => "alice:session1:epoch1");
    state.submit("favourite:true");
    const firstRequest = state.submitted()!;
    state.submit("favourite:true");
    const refreshedRequest = state.submitted()!;
    const refreshed = { items: [], total: 2, unavailable: [] };
    state.remember(state.scope(), "favourite:true", 0, refreshed, refreshedRequest);
    state.remember(
      state.scope(),
      "favourite:true",
      0,
      { items: [], total: 1, unavailable: [] },
      firstRequest,
    );
    expect(state.cached("favourite:true", 0)).toBe(refreshed);
    dispose();
  });
});

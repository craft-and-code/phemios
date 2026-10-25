import { createRoot, createSignal } from "solid-js";
import { expect, it } from "vitest";
import { createNavigation } from "./history";
import { navigationTestHost } from "./history-test-host";

it("returns to each section's last viewport after sidebar navigation", () => {
  createRoot((dispose) => {
    const view = navigationTestHost();
    const nav = createNavigation(view.host, () => "Catalogue");
    view.setTop(1280);
    nav.navigate("#/albums");
    expect(view.top()).toBe(0);
    view.setTop(640);
    nav.navigate("#/artists");
    expect(view.top()).toBe(1280);
    nav.navigate("#/albums");
    expect(view.top()).toBe(640);
    dispose();
  });
});

it("keeps two collection shortcuts and the collections manager independent", () => {
  createRoot((dispose) => {
    const first = "#/collection/11111111-1111-4111-8111-111111111111";
    const second = "#/collection/22222222-2222-4222-8222-222222222222";
    const view = navigationTestHost(first);
    const nav = createNavigation(view.host, () => "Collection");
    view.setTop(420);
    nav.navigate(second);
    view.setTop(180);
    nav.navigate("#/collections");
    view.setTop(75);
    nav.navigate(first);
    expect(view.top()).toBe(420);
    nav.navigate(second);
    expect(view.top()).toBe(180);
    nav.navigate("#/collections");
    expect(view.top()).toBe(75);
    dispose();
  });
});

it("retains per-entry detail return positions instead of the latest section visit", () => {
  createRoot((dispose) => {
    const view = navigationTestHost();
    const nav = createNavigation(view.host, () => "Catalogue");
    view.setTop(480);
    nav.navigate("#/artist/artist%3Anacre");
    view.setTop(210);
    nav.navigate("#/artists");
    expect(view.top()).toBe(480);
    view.setTop(900);
    nav.goBack();
    expect(view.top()).toBe(210);
    nav.goBack();
    expect(view.top()).toBe(480);
    dispose();
  });
});

it("does not apply an older deferred restoration after returning to the same route", () => {
  createRoot((dispose) => {
    const view = navigationTestHost("#/artists", true);
    const nav = createNavigation(view.host, () => "Catalogue");
    view.setTop(480);
    nav.navigate("#/albums");
    view.setTop(0);
    nav.navigate("#/artists");
    view.setTop(200);
    nav.navigate("#/albums");
    view.setTop(0);
    nav.navigate("#/artists");
    view.flush();
    expect(view.restored).toEqual([200]);
    dispose();
  });
});

it("drops remembered and historical positions when the account or source changes", () => {
  const state = createRoot((dispose) => {
    const [owner, setOwner] = createSignal<unknown>({ account: "first" });
    const view = navigationTestHost();
    const nav = createNavigation(view.host, () => "Catalogue", owner);
    return { dispose, view, nav, setOwner };
  });
  state.view.setTop(1200);
  state.nav.navigate("#/albums");
  state.view.setTop(350);
  state.setOwner({ account: "second" });
  expect(state.view.top()).toBe(0);
  state.nav.navigate("#/artists");
  expect(state.view.top()).toBe(0);
  state.nav.goBack();
  state.nav.goBack();
  expect(state.view.top()).toBe(0);
  state.dispose();
});

it("leaves the current viewport untouched when clicking the active section", () => {
  createRoot((dispose) => {
    const view = navigationTestHost();
    const nav = createNavigation(view.host, () => "Catalogue");
    view.setTop(730);
    expect(nav.navigate("#/artists")).toBe(true);
    expect(view.top()).toBe(730);
    expect(view.restored).toEqual([]);
    dispose();
  });
});

it("starts explicit new filter destinations at the top, including the active route", () => {
  createRoot((dispose) => {
    const view = navigationTestHost();
    const nav = createNavigation(view.host, () => "Catalogue");
    nav.navigate("#/albums");
    view.setTop(960);
    nav.navigate("#/artists");
    nav.navigate("#/albums", { resetScroll: true });
    expect(view.top()).toBe(0);
    view.setTop(300);
    nav.navigate("#/albums", { resetScroll: true });
    expect(view.top()).toBe(0);
    dispose();
  });
});

it("does not save the previous owner's viewport during navigation before the reset frame", () => {
  const state = createRoot((dispose) => {
    const [owner, setOwner] = createSignal<unknown>({ account: "first" });
    const view = navigationTestHost("#/artists", true);
    const nav = createNavigation(view.host, () => "Catalogue", owner);
    return { dispose, view, nav, setOwner };
  });
  state.view.setTop(1200);
  state.nav.navigate("#/albums");
  state.view.flush();
  state.view.setTop(500);
  state.setOwner({ account: "second" });
  state.nav.navigate("#/artists");
  state.view.flush();
  expect(state.view.top()).toBe(0);
  state.nav.navigate("#/albums");
  state.view.flush();
  expect(state.view.top()).toBe(0);
  state.dispose();
});

import { createRoot, createSignal } from "solid-js";
import { expect, it } from "vitest";
import { createNavigation } from "./history";
import { navigationTestHost } from "./history-test-host";
it.each(["settings", "playback"] as const)(
  "returns from %s to the exact previous detail and viewport",
  (section) => {
    createRoot((dispose) => {
      const view = navigationTestHost("#/album/release%3Afixture");
      const nav = createNavigation(view.host, () => "Album");
      view.setTop(420);
      nav.toggleSection(section);
      expect(nav.route()).toEqual({ kind: "section", section });
      view.setTop(170);
      nav.toggleSection(section);
      expect(nav.route()).toEqual({ kind: "album", reference: "release:fixture" });
      expect(view.top()).toBe(420);
      nav.toggleSection(section);
      expect(nav.route()).toEqual({ kind: "section", section });
      dispose();
    });
  },
);
it("unwinds nested Settings and Playback visits in their real order", () => {
  createRoot((dispose) => {
    const view = navigationTestHost("#/albums");
    const nav = createNavigation(view.host, () => "Catalogue");
    nav.toggleSection("settings");
    nav.toggleSection("playback");
    nav.toggleSection("playback");
    expect(nav.route()).toEqual({ kind: "section", section: "settings" });
    nav.toggleSection("settings");
    expect(nav.route()).toEqual({ kind: "section", section: "albums" });
    dispose();
  });
});
it("uses a safe catalogue fallback for a directly opened section", () => {
  createRoot((dispose) => {
    const view = navigationTestHost("#/settings");
    const nav = createNavigation(view.host, () => "Catalogue");
    nav.toggleSection("settings");
    expect(nav.route()).toEqual({ kind: "section", section: "artists" });
    dispose();
  });
});
it("uses the new origin after ordinary navigation rather than an older toggle visit", () => {
  createRoot((dispose) => {
    const view = navigationTestHost("#/albums");
    const nav = createNavigation(view.host, () => "Catalogue");
    nav.toggleSection("settings");
    nav.navigate("#/tracks");
    nav.toggleSection("settings");
    nav.toggleSection("settings");
    expect(nav.route()).toEqual({ kind: "section", section: "tracks" });
    dispose();
  });
});

it.each(["settings", "playback"] as const)(
  "does not show a previous account's private return label after closing %s",
  (section) => {
    const state = createRoot((dispose) => {
      const [owner, setOwner] = createSignal("first-account");
      const view = navigationTestHost("#/collection/11111111-1111-4111-8111-111111111111");
      const nav = createNavigation(
        view.host,
        (hash) => (hash.startsWith("#/collection/") ? "Private collection of Alice" : "Album"),
        owner,
      );
      return { dispose, view, nav, setOwner };
    });
    try {
      state.nav.navigate("#/album/release%3Afixture");
      expect(state.nav.backLink()?.label).toBe("Private collection of Alice");
      state.nav.toggleSection(section);
      state.setOwner("second-account");
      state.nav.toggleSection(section);
      expect(state.nav.backLink()?.label).not.toBe("Private collection of Alice");
      expect(state.nav.collectionMenu()).toBeUndefined();
    } finally {
      state.dispose();
    }
  },
);
it("retires a historical private return origin even when the new owner uses browser Back", () => {
  const state = createRoot((dispose) => {
    const [owner, setOwner] = createSignal("first-source");
    const view = navigationTestHost("#/collection/11111111-1111-4111-8111-111111111111");
    const nav = createNavigation(view.host, () => "Private collection of Alice", owner);
    return { dispose, view, nav, setOwner };
  });
  try {
    state.nav.navigate("#/album/release%3Afixture");
    state.nav.toggleSection("settings");
    state.setOwner("second-source");
    state.view.host.back();
    expect(state.nav.route()).toEqual({ kind: "album", reference: "release:fixture" });
    expect(state.nav.backLink()).toEqual({ href: "#/albums", label: "Tous les albums" });
    expect(state.nav.collectionMenu()).toBeUndefined();
  } finally {
    state.dispose();
  }
});

it("does not admit another frontend lifetime's cached private origin after reload", () => {
  const view = navigationTestHost("#/collection/11111111-1111-4111-8111-111111111111");
  createRoot((dispose) => {
    const nav = createNavigation(
      view.host,
      () => "Private collection of Alice",
      () => "first",
    );
    nav.navigate("#/album/release%3Afixture");
    dispose();
  });
  createRoot((dispose) => {
    const nav = createNavigation(
      view.host,
      () => "Catalogue",
      () => "second",
    );
    expect(nav.backLink()).toEqual({ href: "#/albums", label: "Tous les albums" });
    expect(nav.collectionMenu()).toBeUndefined();
    dispose();
  });
});

it("retains the latest chosen destination while an icon return is still pending", () => {
  createRoot((dispose) => {
    const view = navigationTestHost("#/albums", false, true);
    const nav = createNavigation(view.host, () => "Catalogue");
    nav.toggleSection("settings");
    nav.toggleSection("settings");
    nav.navigate("#/artists");
    nav.navigate("#/tracks");
    view.flushBack();
    expect(nav.route()).toEqual({ kind: "section", section: "tracks" });
    nav.toggleSection("playback");
    nav.toggleSection("playback");
    view.flushBack();
    expect(nav.route()).toEqual({ kind: "section", section: "tracks" });
    dispose();
  });
});
it("keeps a new view-icon destination chosen during an older pending return", () => {
  createRoot((dispose) => {
    const view = navigationTestHost("#/albums", false, true);
    const nav = createNavigation(view.host, () => "Catalogue");
    nav.toggleSection("settings");
    nav.toggleSection("settings");
    nav.toggleSection("playback");
    view.flushBack();
    expect(nav.route()).toEqual({ kind: "section", section: "playback" });
    dispose();
  });
});
it("retires old queued destinations on account replacement while a return is pending", () => {
  const state = createRoot((dispose) => {
    const [owner, setOwner] = createSignal("first");
    const view = navigationTestHost("#/collections", false, true);
    const nav = createNavigation(view.host, () => "Catalogue", owner);
    return { dispose, view, nav, setOwner };
  });
  try {
    state.nav.toggleSection("settings");
    state.nav.toggleSection("settings");
    state.nav.navigate("#/playlists");
    state.setOwner("second");
    state.view.flushBack();
    expect(state.nav.route()).toEqual({ kind: "section", section: "settings" });
    state.nav.navigate("#/artists");
    state.nav.toggleSection("settings");
    state.nav.toggleSection("settings");
    state.view.flushBack();
    expect(state.nav.route()).toEqual({ kind: "section", section: "artists" });
  } finally {
    state.dispose();
  }
});

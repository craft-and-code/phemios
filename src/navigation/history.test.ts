import { createRoot } from "solid-js";
import { it, expect } from "vitest";
import { createNavigation, type NavigationHost } from "./history";
it("returns through actual origin pages and restores their scroll positions", () => {
  createRoot((dispose) => {
    const entries = [{ hash: "#/genres", state: {} as unknown }];
    let index = 0,
      top = 480,
      listener = () => {};
    const host: NavigationHost = {
      current: () => entries[index]!,
      push: (hash, state) => {
        entries.splice(index + 1);
        entries.push({ hash, state });
        index++;
      },
      replace: (state) => {
        entries[index]!.state = state;
      },
      back: () => {
        index--;
        listener();
      },
      top: () => top,
      restore: (value) => {
        top = value;
      },
      defer: (fn) => fn(),
      listen: (fn) => {
        listener = fn;
        return () => {
          listener = () => {};
        };
      },
    };
    const nav = createNavigation(host, (hash) => (hash.includes("artist/") ? "Nacre" : "Genres"));
    nav.navigate("#/artist/artist%3Anacre");
    expect(nav.backLink()).toEqual({ href: "#/genres", label: "Genres" });
    expect(top).toBe(0);
    top = 200;
    nav.navigate("#/album/release%3Aone");
    expect(nav.backLink()?.label).toBe("Nacre");
    nav.goBack();
    expect(nav.route()).toEqual({ kind: "artist", reference: "artist:nacre" });
    expect(top).toBe(200);
    nav.goBack();
    expect(nav.route()).toEqual({ kind: "section", section: "genres" });
    expect(top).toBe(480);
    dispose();
  });
});
it("uses safe catalog fallbacks for deep links and refuses external navigation", () => {
  createRoot((dispose) => {
    const host: NavigationHost = {
      current: () => ({
        hash: "#/album/release%3Aone",
        state: {
          phemiosNavigation: {
            version: 1,
            hash: "#/album/release%3Aone",
            top: -4,
            origin: { href: "javascript:alert(1)", label: "Bad" },
          },
        },
      }),
      push: () => {},
      replace: () => {},
      back: () => {},
      top: () => 0,
      restore: () => {},
      defer: (fn) => fn(),
      listen: () => () => {},
    };
    const nav = createNavigation(host, () => "Catalog");
    expect(nav.backLink()).toEqual({ href: "#/albums", label: "Tous les albums" });
    expect(nav.navigate("https://example.org")).toBe(false);
    dispose();
  });
});

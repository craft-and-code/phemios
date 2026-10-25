import { createRoot } from "solid-js";
import { expect, it } from "vitest";
import { parseRoute, navigationLabel } from "./routes";
import { createNavigation, type NavigationHost } from "./history";
import { collectionMenuHref } from "./collection-menu";
const id = "collection:11111111-1111-4111-8111-111111111111" as const;
it("routes only opaque shortcut identifiers and retains the literal custom origin label", () => {
  const route = parseRoute(collectionMenuHref(id));
  expect(route).toEqual({ kind: "section", section: "collections", collectionMenu: id });
  expect(
    navigationLabel(
      route,
      (_section, shortcut) => (shortcut === id ? "Mes disques" : "Collections"),
      () => undefined,
    ),
  ).toBe("Mes disques");
  for (const value of [
    "#/collection/private-name",
    "#/collection/../albums",
    collectionMenuHref(id) + "/extra",
    "#/collection/%31%31",
  ])
    expect(parseRoute(value)).toEqual({ kind: "not-found" });
});
it("retains the selected collection menu and scroll through album/artist detail navigation", () =>
  createRoot((dispose) => {
    const entries = [{ hash: collectionMenuHref(id), state: {} as unknown }];
    let index = 0,
      top = 420,
      listener = () => {};
    const host: NavigationHost = {
      current: () => entries[index]!,
      push: (hash, state) => {
        entries.splice(++index);
        entries.push({ hash, state });
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
        return () => {};
      },
    };
    const nav = createNavigation(host, () => "Mon Jazz");
    expect(nav.collectionMenu()).toBe(id);
    nav.navigate("#/album/release%3Ajazz");
    expect(nav.collectionMenu()).toBe(id);
    expect(nav.backLink()).toEqual({ href: collectionMenuHref(id), label: "Mon Jazz" });
    nav.navigate("#/artist/artist%3Ajazz");
    expect(nav.collectionMenu()).toBe(id);
    nav.goBack();
    nav.goBack();
    expect(nav.collectionMenu()).toBe(id);
    expect(top).toBe(420);
    nav.navigate("#/artists");
    expect(nav.collectionMenu()).toBeUndefined();
    dispose();
  }));

import { createRoot, createComputed } from "solid-js";
import { expect, it } from "vitest";
import { createViewSession } from "./view-session";

it("retains label album sorting and direction after a page owner is disposed and remounted", () => {
  createRoot((disposeApp) => {
    try {
      const session = createViewSession();
      createRoot((disposePage) => {
        const [, sort] = session.control("labelsSort"),
          [, descending] = session.control("labelsDescending");
        sort("albums");
        descending(true);
        disposePage();
      });
      createRoot((disposePage) => {
        expect(session.control("labelsSort")[0]()).toBe("albums");
        expect(session.control("labelsDescending")[0]()).toBe(true);
        disposePage();
      });
    } finally {
      disposeApp();
    }
  });
});

it("keeps each view's icons independent and notifies active consumers of functional updates", () => {
  createRoot((dispose) => {
    try {
      const session = createViewSession(),
        [favourites, setFavourites] = session.control("favouritesCompact"),
        [tags] = session.control("tagsCompact");
      const observed: boolean[] = [];
      createComputed(() => observed.push(favourites()));
      setFavourites((value) => !value);
      expect(session.control("favouritesCompact")[0]()).toBe(true);
      expect(tags()).toBe(false);
      expect(observed).toEqual([false, true]);
      session.control("catalogReverse")[1]({ albums: true });
      expect(session.control("catalogReverse")[0]().albums).toBe(true);
      expect(session.control("catalogReverse")[0]().compilations).toBeUndefined();
    } finally {
      dispose();
    }
  });
});

it("starts a new App with defaults, without sharing mutable state between sessions", () => {
  const previous = createViewSession();
  previous.control("labelsSort")[1]("albums");
  previous.control("labelsDescending")[1](true);
  previous.control("collectionsReverse")[1](true);
  previous.control("analysisSort")[1]({ column: "title", direction: "asc" });
  const next = createViewSession();
  expect(next.control("labelsSort")[0]()).toBe("name");
  expect(next.control("labelsDescending")[0]()).toBe(false);
  expect(next.control("collectionsReverse")[0]()).toBe(false);
  expect(next.control("analysisSort")[0]()).toEqual({ column: "missing", direction: "desc" });
});

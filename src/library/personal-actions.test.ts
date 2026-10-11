import { createRoot, createSignal } from "solid-js";
import { expect, it } from "vitest";
import { createPersonalActions } from "./personal-actions";
import type { AccountSession } from "./server";
import type { Section } from "../navigation/routes";
const owner = (): AccountSession => ({
  server: "https://catalog.example",
  account: { id: "same-id", username: "listener", role: "user" },
});
it("clears personal drafts for a replacement session on the same catalogue source", () => {
  let dispose!: () => void,
    draft = "";
  const [session, setSession] = createSignal<AccountSession | undefined>(owner());
  const actions = createRoot((cleanup) => {
    dispose = cleanup;
    return createPersonalActions(
      () => "collections",
      session,
      () => "server",
      () => {
        draft = "";
      },
    );
  });
  try {
    draft = "private collection rule";
    const admitted = actions.capture();
    setSession(owner());
    expect(draft).toBe("");
    expect(admitted()).toBe(false);
    draft = "another private rule";
    setSession(undefined);
    expect(draft).toBe("");
  } finally {
    dispose();
  }
});
it("does not revive a delayed action after leaving and returning to the same view", () => {
  let dispose!: () => void;
  const [section, setSection] = createSignal<Section>("collections");
  const session = owner();
  const actions = createRoot((cleanup) => {
    dispose = cleanup;
    return createPersonalActions(
      section,
      () => session,
      () => "server",
      () => {},
    );
  });
  const oldAction = actions.capture();
  setSection("history");
  setSection("collections");
  expect(oldAction()).toBe(false);
  const freshAction = actions.capture();
  expect(freshAction()).toBe(true);
  dispose();
  expect(freshAction()).toBe(false);
});

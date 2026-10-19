import { createRoot, createSignal } from "solid-js";
import { expect, it, vi } from "vitest";
import type { AccountSession } from "./server";
import { createSelectionCollection } from "./selection-collection";
import { saveBrowsingCollection } from "./collection-save";
vi.mock("./collection-save", () => ({ saveBrowsingCollection: vi.fn() }));
const owner: AccountSession = {
  server: "https://music.example",
  account: { id: "first", username: "listener", role: "user" },
};
it("clears private collection drafts and confirmations on account replacement", async () => {
  let dispose!: () => void;
  const [session, setSession] = createSignal<AccountSession | undefined>(owner);
  const state = createRoot((cleanup) => {
    dispose = cleanup;
    return createSelectionCollection(() => "server", session);
  });
  try {
    state.open("private criteria");
    state.setName("Private collection name");
    vi.mocked(saveBrowsingCollection).mockResolvedValue(undefined);
    await state.save();
    expect(state.message()).toContain("Private collection name");
    setSession(undefined);
    expect(state.message()).toBe("");
    expect(state.name()).toBe("");
    setSession(owner);
    state.open("another private selection");
    state.setName("Unsubmitted private draft");
    setSession({ ...owner, account: { ...owner.account, id: "other" } });
    expect(state.draft()).toBeUndefined();
    expect(state.name()).toBe("");
  } finally {
    dispose();
  }
});

it.each(["account", "source"] as const)(
  "rejects a retired save without clearing its successor after a %s round trip",
  async (change) => {
    let dispose!: () => void, finishOld!: () => void, finishNew!: () => void;
    const [session, setSession] = createSignal<AccountSession | undefined>(owner),
      [source, setSource] = createSignal<"local" | "server">("server");
    const state = createRoot((cleanup) => {
      dispose = cleanup;
      return createSelectionCollection(source, session);
    });
    vi.mocked(saveBrowsingCollection)
      .mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            finishOld = resolve;
          }),
      )
      .mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            finishNew = resolve;
          }),
      );
    try {
      state.open("old criteria");
      state.setName("Old name");
      const oldSave = state.save();
      const oldAdmission = vi.mocked(saveBrowsingCollection).mock.calls.at(-1)![2];
      if (change === "account") {
        setSession(undefined);
        setSession(owner);
      } else {
        setSource("local");
        setSource("server");
      }
      expect(oldAdmission()).toBe(false);
      state.open("new criteria");
      state.setName("New name");
      const newSave = state.save();
      finishOld();
      await oldSave;
      expect(state.busy()).toBe(true);
      expect(state.draft()).toBe("new criteria");
      expect(state.message()).toBe("");
      finishNew();
      await newSave;
      expect(state.busy()).toBe(false);
      expect(state.message()).toContain("New name");
    } finally {
      dispose();
    }
  },
);

it("retires an in-flight collection save on disposal", async () => {
  let dispose!: () => void, finish!: () => void;
  const state = createRoot((cleanup) => {
    dispose = cleanup;
    return createSelectionCollection(
      () => "server",
      () => owner,
    );
  });
  vi.mocked(saveBrowsingCollection).mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  state.open("criteria");
  state.setName("Private name");
  const pending = state.save();
  const current = vi.mocked(saveBrowsingCollection).mock.calls.at(-1)![2];
  dispose();
  expect(current()).toBe(false);
  finish();
  await pending;
  expect(state.message()).toBe("");
});

import { createRoot, createSignal } from "solid-js";
import { expect, it, vi } from "vitest";
import { createAnnotationRead } from "./annotation-read";
import type { AccountSession, Annotation } from "./server";
const owner = (server: string): AccountSession => ({
  server,
  account: { id: "same-id", username: "listener", role: "user" },
});
const saved: Annotation = {
  reference: "artist:one",
  loved: true,
  rating: 4,
  note: "private note",
  tags: ["private tag"],
};
const settle = async () => {
  for (let i = 0; i < 8; i++) await Promise.resolve();
};
it("immediately hides retained personal detail when logging out or replacing its owner", async () => {
  let dispose!: () => void;
  const [session, setSession] = createSignal<AccountSession | undefined>(
    owner("https://one.example"),
  );
  const request = vi
    .fn()
    .mockResolvedValueOnce({ annotation: saved })
    .mockReturnValue(new Promise(() => {}));
  const read = createRoot((cleanup) => {
    dispose = cleanup;
    return createAnnotationRead(() => "artist:one", session, request);
  });
  await settle();
  expect(read.current()).toEqual(saved);
  setSession(undefined);
  expect(read.current()).toBeUndefined();
  setSession(owner("https://two.example"));
  expect(read.current()).toBeUndefined();
  expect(read.loading()).toBe(true);
  dispose();
});
it("refuses wrong-target personal replies and never exposes a late old-owner response", async () => {
  let dispose!: () => void, finish!: (value: unknown) => void;
  const [session, setSession] = createSignal<AccountSession | undefined>(
    owner("https://one.example"),
  );
  const request = vi
    .fn()
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    )
    .mockResolvedValue({ annotation: { ...saved, reference: "artist:other" } });
  const read = createRoot((cleanup) => {
    dispose = cleanup;
    return createAnnotationRead(() => "artist:one", session, request);
  });
  setSession(owner("https://two.example"));
  finish({ annotation: saved });
  await settle();
  expect(read.current()).toBeUndefined();
  expect(read.error()).not.toBe("");
  setSession(undefined);
  expect(read.error()).toBe("");
  dispose();
});

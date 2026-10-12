import { createEffect, createRoot, createSignal } from "solid-js";
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
    .mockResolvedValueOnce({ reference: saved.reference, annotation: saved })
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
    .mockResolvedValue({
      reference: saved.reference,
      annotation: { ...saved, reference: "artist:other" },
    });
  const read = createRoot((cleanup) => {
    dispose = cleanup;
    return createAnnotationRead(() => "artist:one", session, request);
  });
  setSession(owner("https://two.example"));
  finish({ reference: saved.reference, annotation: saved });
  await settle();
  expect(read.current()).toBeUndefined();
  expect(read.error()).not.toBe("");
  setSession(undefined);
  expect(read.error()).toBe("");
  dispose();
});

it("reads an owner-qualified Aède annotation outside the artist album track subset", async () => {
  let dispose!: () => void;
  const reference = "genre:@phemios/local/fixture",
    row = { ...saved, reference };
  const read = createRoot((cleanup) => {
    dispose = cleanup;
    return createAnnotationRead(
      () => reference,
      () => owner("local"),
      async () => ({ reference, annotation: row }),
    );
  });
  await settle();
  expect(read.current()).toEqual(row);
  expect(read.error()).toBe("");
  dispose();
});
it("keeps unreadable replies local and provides a detail without repeating the panel heading", async () => {
  let dispose!: () => void;
  const read = createRoot((cleanup) => {
    dispose = cleanup;
    return createAnnotationRead(
      () => "artist:fixture",
      () => owner("local"),
      async () => ({}),
    );
  });
  await settle();
  expect(read.current()).toBeUndefined();
  expect(read.error()).toBe("Réponse d’annotation Aède invalide.");
  expect(read.error()).not.toContain("Annotations illisibles");
  dispose();
});

it("refuses wrong or absent outer targets even for null while retaining the confirmed detail", async () => {
  let dispose!: () => void;
  const request = vi.fn().mockResolvedValue({ reference: saved.reference, annotation: saved });
  let confirmed: Annotation | null = saved;
  const read = createRoot((cleanup) => {
    dispose = cleanup;
    const result = createAnnotationRead(
      () => saved.reference,
      () => owner("local"),
      request,
    );
    createEffect(() => {
      const row = result.current();
      if (row !== undefined) confirmed = row;
    });
    return result;
  });
  try {
    await settle();
    expect(read.current()).toBe(saved);
    for (const raw of [
      { reference: "artist:other", annotation: null },
      { annotation: null },
      { reference: 7, annotation: null },
      { reference: "unknown:fixture", annotation: null },
      { reference: "artist:other", annotation: saved },
      { reference: saved.reference, annotation: { ...saved, reference: "artist:other" } },
    ]) {
      request.mockResolvedValueOnce(raw);
      await read.refetch();
      await settle();
      expect(read.current()).toBeUndefined();
      expect(read.error()).not.toBe("");
      expect(confirmed).toBe(saved);
    }
    request.mockResolvedValueOnce({ reference: saved.reference, annotation: null });
    await read.refetch();
    await settle();
    expect(read.current()).toBeNull();
    expect(read.error()).toBe("");
    expect(confirmed).toBeNull();
  } finally {
    dispose();
  }
});

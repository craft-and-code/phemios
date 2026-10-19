import { createRoot, createSignal } from "solid-js";
import { expect, it, vi } from "vitest";
import { createCatalogDetail } from "./catalog-detail";
import type { AccountSession } from "./server";
const first: AccountSession = {
  server: "https://music.example",
  account: { id: "first", username: "first", role: "user" },
};
async function settle() {
  for (let i = 0; i < 12; i++) await Promise.resolve();
}
it("refetches the same reference for a replacement login and hides the former detail immediately", async () => {
  let dispose!: () => void;
  const [owner, setOwner] = createSignal<AccountSession | undefined>(first);
  let finish!: (value: string) => void;
  const request = vi
    .fn()
    .mockResolvedValueOnce("former detail")
    .mockImplementationOnce(
      () =>
        new Promise<string>((done) => {
          finish = done;
        }),
    );
  const detail = createRoot((end) => {
    dispose = end;
    return createCatalogDetail(() => "track:one", owner, request);
  });
  try {
    await settle();
    expect(detail.current()).toBe("former detail");
    const next = { ...first, account: { ...first.account, id: "next" } };
    setOwner(next);
    expect(detail.current()).toBeUndefined();
    await settle();
    expect(request).toHaveBeenCalledTimes(2);
    finish("replacement detail");
    await settle();
    expect(detail.current()).toBe("replacement detail");
    setOwner(undefined);
    expect(detail.current()).toBeUndefined();
  } finally {
    dispose();
  }
});
it("retires pending detail admission on logout even when the same account object returns", async () => {
  let dispose!: () => void;
  const [owner, setOwner] = createSignal<AccountSession | undefined>(first);
  let finish!: (value: string) => void;
  let current!: () => boolean;
  const read = vi.fn((_ref, _session, admission) => {
    current = admission.current;
    return new Promise<string>((done) => {
      finish = done;
    });
  });
  const detail = createRoot((end) => {
    dispose = end;
    return createCatalogDetail(() => "release:one", owner, read);
  });
  try {
    await settle();
    const oldCurrent = current;
    const oldFinish = finish;
    setOwner(undefined);
    expect(oldCurrent()).toBe(false);
    setOwner(first);
    await settle();
    expect(oldCurrent()).toBe(false);
    oldFinish("retired detail");
    await settle();
    expect(detail.current()).toBeUndefined();
    finish("fresh detail");
    await settle();
    expect(detail.current()).toBe("fresh detail");
  } finally {
    dispose();
  }
});

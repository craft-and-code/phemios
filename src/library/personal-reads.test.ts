import { createRoot, createSignal } from "solid-js";
import { expect, it, vi } from "vitest";
import { createPersonalReads } from "./personal-reads";
import type { AccountSession } from "./server";
import type { Section } from "../navigation/routes";
const account: AccountSession = {
  server: "http://127.0.0.1:3413",
  account: { id: "listener", username: "listener", role: "user" },
};
const settle = async () => {
  for (let i = 0; i < 8; i++) await Promise.resolve();
};
it("keeps a failed history read visible without throwing or trapping navigation", async () => {
  let dispose!: () => void;
  const request = vi.fn().mockRejectedValue(new Error("History unavailable"));
  const view = createRoot((cleanup) => {
    dispose = cleanup;
    const [section, setSection] = createSignal<Section>("history");
    const reads = createPersonalReads(
      section,
      () => account,
      () => 0,
      request,
    );
    return { ...reads, setSection };
  });
  try {
    await settle();
    expect(() => view.page()).not.toThrow();
    expect(view.page()?.error).toContain("History unavailable");
    view.setSection("favourites");
    await settle();
    expect(view.page()?.data).toBeUndefined();
    request.mockResolvedValueOnce({ items: [], total: 0 });
    view.setSection("history");
    await settle();
    expect(view.page()?.data?.items).toEqual([]);
    expect(view.page()?.error).toBeUndefined();
  } finally {
    dispose();
  }
});
it("rejects malformed pages without mounting invalid history rows", async () => {
  let dispose!: () => void;
  const request = vi.fn().mockResolvedValue({ items: null, total: 1 });
  const reads = createRoot((cleanup) => {
    dispose = cleanup;
    return createPersonalReads(
      () => "history",
      () => account,
      () => 0,
      request,
    );
  });
  try {
    await settle();
    expect(reads.page()?.error).toContain("invalide");
    expect(reads.history()).toEqual([]);
  } finally {
    dispose();
  }
});
it("retains an unavailable history track as a diagnostic and fetches no data after logout", async () => {
  let dispose!: () => void;
  const request = vi
    .fn()
    .mockResolvedValueOnce({
      items: [{ track: "track:missing", at: 100, ms_played: null, completed: null }],
      total: 1,
    })
    .mockRejectedValue(new Error("Missing"));
  const view = createRoot((cleanup) => {
    dispose = cleanup;
    const [session, setSession] = createSignal<AccountSession | undefined>(account);
    return {
      ...createPersonalReads(
        () => "history",
        session,
        () => 0,
        request,
      ),
      setSession,
    };
  });
  try {
    await settle();
    expect(view.history()?.[0]?.title).toBe("Piste indisponible");
    view.setSession(undefined);
    await settle();
    expect(view.history()).toEqual([]);
    expect(request).toHaveBeenCalledTimes(2);
  } finally {
    dispose();
  }
});

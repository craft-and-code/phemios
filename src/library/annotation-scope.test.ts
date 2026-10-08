import { createResource, createRoot, createSignal } from "solid-js";
import { expect, it, vi } from "vitest";
import { annotationScope } from "./annotation-scope";
import type { AccountSession } from "./server";
it("does not refetch after annotation updates rebuild the artist projection", async () => {
  let dispose!: () => void;
  const account: AccountSession = {
    server: "http://127.0.0.1:3413",
    account: { id: "test", username: "listener", role: "user" },
  };
  const fetch = vi.fn().mockResolvedValue({ loved: true });
  const controls = createRoot((cleanup) => {
    dispose = cleanup;
    const [artist, setArtist] = createSignal({
      reference: "artist:sample",
      searchFields: [] as string[],
    });
    const [session, setSession] = createSignal<AccountSession | undefined>(account);
    const scope = annotationScope(() => artist().reference, session);
    createResource(() => (scope().session ? scope() : false), fetch);
    return { setArtist, setSession };
  });
  try {
    await Promise.resolve();
    controls.setArtist({ reference: "artist:sample", searchFields: ["favori"] });
    await Promise.resolve();
    expect(fetch).toHaveBeenCalledOnce();
    controls.setArtist({ reference: "artist:other", searchFields: [] });
    await Promise.resolve();
    expect(fetch).toHaveBeenCalledTimes(2);
    controls.setSession({ ...account });
    await Promise.resolve();
    expect(fetch).toHaveBeenCalledTimes(3);
    controls.setSession(undefined);
    await Promise.resolve();
    expect(fetch).toHaveBeenCalledTimes(3);
  } finally {
    dispose();
  }
});

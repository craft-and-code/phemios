import { createRoot, createSignal } from "solid-js";
import { expect, it, vi } from "vitest";
import { requestAede } from "../platform/desktop";
import { createQueueLyricAvailability } from "./queue-lyrics-availability";
import type { AccountSession } from "./server";
vi.mock("../platform/desktop", () => ({ requestAede: vi.fn() }));
it("retains known lyric timing only for the exact current account", async () => {
  let change!: (value: AccountSession) => void, dispose!: () => void;
  const owner: AccountSession = {
    server: "https://example.invalid",
    account: { id: "first", username: "first", role: "admin" },
  };
  vi.mocked(requestAede).mockImplementation(
    async (_path, query, _method, _body, _source, session) => ({
      track: query?.track ?? "",
      lyrics: {
        source: "sidecar",
        synced: session?.account.id === "first",
        lines: [{ at_ms: session?.account.id === "first" ? 1000 : null, text: "Fictional words" }],
      },
    }),
  );
  const state = createRoot((clean) => {
    dispose = clean;
    const [session, setSession] = createSignal(owner);
    change = setSession;
    return createQueueLyricAvailability({
      queue: () => [{ reference: "track:one" }],
      sessionFor: session,
      jobs: () => [],
    });
  });
  await vi.waitFor(() => expect(state.available("track:one")).toBe(true));
  expect(state.synced("track:one")).toBe(true);
  const other = { ...owner, account: { ...owner.account, id: "second" } };
  change(other);
  expect(state.synced("track:one")).toBeUndefined();
  await vi.waitFor(() => expect(state.synced("track:one")).toBe(false));
  dispose();
});

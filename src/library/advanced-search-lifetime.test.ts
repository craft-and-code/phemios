import { createRoot, createSignal } from "solid-js";
import { expect, it, vi } from "vitest";
import { createDiagnosticRead } from "./diagnostic-read";
import { combinedTrackReader } from "./combined-tracks";
import { readAdvancedTrackPage } from "./advanced-track-read";
import type { AccountSession } from "./server";
const alice: AccountSession = {
  server: "https://music.example",
  nativeSession: "alice-ticket",
  account: { id: "alice", username: "alice", role: "user" },
};
const settle = async () => {
  for (let i = 0; i < 20; i++) await Promise.resolve();
};
it.each(["cancel", "logout", "dispose", "replace"] as const)(
  "retires a chained advanced search on %s without dispatching another owner's search or a later window",
  async (action) => {
    let finish!: (value: unknown) => void, dispose!: () => void;
    const [owner, setOwner] = createSignal<AccountSession | undefined>(alice);
    const request = vi.fn<Parameters<typeof readAdvancedTrackPage>[0]>(
      async (path, _query, _method, _body, _source, held) => {
        if (held === alice)
          return new Promise((resolve) => {
            finish = resolve;
          });
        if (path.endsWith("status")) return { capabilities: ["advanced_search"] };
        return { items: [], total: 0, offset: 0, limit: 50, scanned_at: 1 };
      },
    );
    const read = createRoot((cleanup) => {
      dispose = cleanup;
      return createDiagnosticRead(
        () => (owner() ? { owner: owner()! } : false),
        async (scope, admission) => {
          const reader = combinedTrackReader(
            [{ source: "server", identity: scope.owner.nativeSession! }],
            (source, at, current) =>
              readAdvancedTrackPage(
                request,
                source,
                "note:private",
                at,
                () => scope.owner,
                () => current() && owner() === scope.owner,
              ),
          );
          return reader(50, 50, admission.current);
        },
      );
    });
    try {
      await settle();
      expect(request).toHaveBeenCalledOnce();
      if (action === "cancel") read.cancel();
      if (action === "logout") setOwner(undefined);
      if (action === "dispose") dispose();
      if (action === "replace")
        setOwner({
          ...alice,
          nativeSession: "bob-ticket",
          account: { ...alice.account, id: "bob" },
        });
      await settle();
      finish({ capabilities: ["advanced_search", "private_achievements"] });
      await settle();
      expect(request.mock.calls.filter((call) => call[5] === alice)).toHaveLength(1);
      expect(read.error()).toBe("");
      if (action === "replace") {
        expect(read.current()).toEqual({ items: [], total: 0, unavailable: [] });
        expect(request.mock.calls.map((call) => call[0])).toEqual([
          "/api/v1/status",
          "/api/v1/status",
          "/api/me/v1/search",
        ]);
      } else expect(read.current()).toBeUndefined();
    } finally {
      dispose();
    }
  },
);

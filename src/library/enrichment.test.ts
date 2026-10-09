import { expect, it, vi } from "vitest";
import { startEnrichment } from "./enrichment";
it("uses the same operation for both sources and retains a partial failure without duplicating accepted work", async () => {
  const start = vi.fn(async (source: string) => {
    if (source === "server") throw new Error("Update required");
    return { task_id: 7 };
  });
  expect(await startEnrichment(["local", "server"], start)).toEqual([
    { source: "local", task: 7 },
    { source: "server", error: "Error: Update required" },
  ]);
  expect(start.mock.calls).toEqual([["local"], ["server"]]);
});

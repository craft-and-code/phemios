import { beforeEach, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { clearServerCache, pickLocalExclusions } from "./desktop";
vi.mock("@tauri-apps/api/core", () => ({ isTauri: () => true, invoke: vi.fn() }));
beforeEach(() => vi.mocked(invoke).mockReset());
const runtime = {
  bridgeVersion: 1,
  name: "Phémios",
  native: true,
  version: "0.1.0",
  capabilities: ["server_cache_clear", "local_exclusion_picker"],
};
it.each(["clear", "picker"] as const)(
  "does not dispatch %s after its capability lookup is retired",
  async (action) => {
    let current = true,
      finish!: (value: typeof runtime) => void;
    vi.mocked(invoke).mockImplementation((command) =>
      command === "runtime_info"
        ? new Promise((resolve) => {
            finish = resolve;
          })
        : Promise.resolve([]),
    );
    const pending =
      action === "clear" ? clearServerCache(() => current) : pickLocalExclusions(() => current);
    current = false;
    finish(runtime);
    await pending.catch(() => {});
    expect(invoke).toHaveBeenCalledTimes(1);
    expect(invoke).toHaveBeenCalledWith("runtime_info");
  },
);
it("dispatches only the fixed native commands for current supported hosts", async () => {
  vi.mocked(invoke)
    .mockResolvedValueOnce(runtime)
    .mockResolvedValueOnce(undefined)
    .mockResolvedValueOnce(runtime)
    .mockResolvedValueOnce(["/music/excluded"]);
  await clearServerCache(() => true);
  expect(invoke).toHaveBeenLastCalledWith("aede_clear_server_cache", { version: 1 });
  expect(await pickLocalExclusions(() => true)).toEqual(["/music/excluded"]);
  expect(invoke).toHaveBeenLastCalledWith("local_pick_exclusions", { version: 1 });
});

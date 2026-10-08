import { expect, it, vi } from "vitest";
import { saveBrowsingCollection } from "./collection-save";
import { requestAede } from "../platform/desktop";
vi.mock("../platform/desktop", () => ({ requestAede: vi.fn() }));
it("explains an outdated server before sending unsupported collection writes", async () => {
  vi.mocked(requestAede).mockResolvedValue({ api_version: 1 });
  await expect(saveBrowsingCollection("Era", "browse-v1:{}", () => true)).rejects.toThrow(
    /redémarr/i,
  );
  expect(requestAede).toHaveBeenCalledTimes(1);
});
it("creates a rule only for the same session after capability confirmation", async () => {
  vi.mocked(requestAede).mockClear();
  vi.mocked(requestAede).mockResolvedValue({ capabilities: ["dynamic_browse_collections"] });
  await saveBrowsingCollection("Era", "browse-v1:{}", () => false);
  expect(requestAede).toHaveBeenCalledTimes(1);
  await saveBrowsingCollection("Era", "browse-v1:{}", () => true);
  expect(requestAede).toHaveBeenLastCalledWith("/api/me/v1/collection", { name: "Era" }, "PUT", {
    expression: "browse-v1:{}",
    create_only: true,
  });
});

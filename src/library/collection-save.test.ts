import { expect, it, vi } from "vitest";
import { saveBrowsingCollection, deleteSavedCollection } from "./collection-save";
import { requestAede } from "../platform/desktop";
vi.mock("../platform/desktop", () => ({ requestAede: vi.fn() }));
it("deletes only the explicitly chosen owner collection and never reports a replacement session's success", async () => {
  vi.mocked(requestAede).mockClear();
  expect(await deleteSavedCollection("Road", "local", () => false)).toBe(false);
  expect(requestAede).not.toHaveBeenCalled();
  let current = true;
  vi.mocked(requestAede).mockImplementationOnce(async () => {
    current = false;
    return null;
  });
  expect(await deleteSavedCollection("Road", "local", () => current)).toBe(false);
  expect(requestAede).toHaveBeenLastCalledWith(
    "/api/me/v1/collection",
    { name: "Road" },
    "DELETE",
    null,
    "local",
  );
});
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

it("refuses multi-genre rules on servers supporting only legacy browsing", async () => {
  vi.mocked(requestAede).mockClear();
  vi.mocked(requestAede).mockResolvedValue({ capabilities: ["dynamic_browse_collections"] });
  await expect(
    saveBrowsingCollection("Styles", 'browse-v1:{"genres":["Metal","Rock"]}', () => true),
  ).rejects.toThrow(/plusieurs genres/);
  expect(requestAede).toHaveBeenCalledTimes(1);
  vi.mocked(requestAede).mockResolvedValue({
    capabilities: ["dynamic_browse_collections", "dynamic_browse_genres"],
  });
  await saveBrowsingCollection("Styles", 'browse-v1:{"genres":["Metal","Rock"]}', () => true);
  expect(requestAede).toHaveBeenLastCalledWith("/api/me/v1/collection", { name: "Styles" }, "PUT", {
    expression: 'browse-v1:{"genres":["Metal","Rock"]}',
    create_only: true,
  });
});

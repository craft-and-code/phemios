import { expect, it, vi } from "vitest";
import { renameSavedCollection } from "./collection-rename";
import { requestAede } from "../platform/desktop";
vi.mock("../platform/desktop", () => ({ requestAede: vi.fn() }));
it("renames atomically on the captured source without sending an expression or deleting a collection", async () => {
  vi.mocked(requestAede).mockResolvedValue({ capabilities: ["collection_rename"] });
  expect(await renameSavedCollection("Old", " New ", "local", () => true)).toBe(true);
  expect(requestAede).toHaveBeenLastCalledWith(
    "/api/me/v1/collection",
    { name: "Old" },
    "PATCH",
    { name: "New" },
    "local",
  );
  vi.mocked(requestAede).mockClear();
  expect(await renameSavedCollection("Old", "New", "server", () => false)).toBe(false);
  expect(requestAede).not.toHaveBeenCalled();
  let current = true;
  vi.mocked(requestAede).mockImplementationOnce(async () => {
    current = false;
    return { capabilities: ["collection_rename"] };
  });
  expect(await renameSavedCollection("Old", "New", "server", () => current)).toBe(false);
  expect(requestAede).toHaveBeenCalledOnce();
});
it("explains an unsupported server and preserves rename failures", async () => {
  vi.mocked(requestAede).mockClear();
  vi.mocked(requestAede).mockResolvedValue({});
  await expect(renameSavedCollection("Old", "New", "server", () => true)).rejects.toThrow(
    /redémarr/,
  );
  expect(requestAede).toHaveBeenCalledOnce();
  vi.mocked(requestAede)
    .mockResolvedValueOnce({ capabilities: ["collection_rename"] })
    .mockRejectedValueOnce(new Error("Collision"));
  await expect(renameSavedCollection("Old", "New", "server", () => true)).rejects.toThrow(
    "Collision",
  );
});

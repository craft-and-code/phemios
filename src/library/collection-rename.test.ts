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

it("uses the captured owner and stable ID for a rename from either view", async () => {
  const session = {
    server: "https://catalog.example",
    account: { id: "owner", username: "Owner", role: "user" as const },
    nativeSession: "captured",
  };
  const id = `collection-${"a".repeat(64)}`;
  vi.mocked(requestAede)
    .mockReset()
    .mockResolvedValueOnce({ capabilities: ["collection_identity"] })
    .mockResolvedValueOnce({ id, name: "New", expression: "loved" });
  expect(await renameSavedCollection("Old", " New ", "server", () => true, id, session)).toBe(true);
  expect(requestAede).toHaveBeenNthCalledWith(
    1,
    "/api/v1/status",
    {},
    "GET",
    null,
    "server",
    session,
  );
  expect(requestAede).toHaveBeenLastCalledWith(
    "/api/me/v1/collection",
    { id },
    "PATCH",
    { name: "New" },
    "server",
    session,
  );
  vi.mocked(requestAede)
    .mockReset()
    .mockResolvedValueOnce({ capabilities: ["collection_rename"] });
  await expect(
    renameSavedCollection("Old", "New", "server", () => true, id, session),
  ).rejects.toThrow();
  expect(requestAede).toHaveBeenCalledOnce();
});

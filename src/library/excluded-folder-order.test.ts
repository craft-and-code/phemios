import { expect, it } from "vitest";
import { createExcludedFolderOrder } from "./excluded-folder-order";
import type { AccountSession } from "./server";
const owner: AccountSession = {
  server: "http://127.0.0.1:9000",
  account: { id: "alice", username: "Alice", role: "admin" },
};
function fixture() {
  const data = new Map<string, string>();
  const storage = {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, raw: string) => {
      data.set(key, raw);
    },
  };
  return { data, storage, order: createExcludedFolderOrder(storage) };
}
it("persists presentation order per local owner without storing paths or reassigning rules", async () => {
  const { order, data } = fixture();
  await order.save(owner, ["/music/b", "/music/a"], () => true);
  expect(await order.read(owner, ["/music/a", "/music/b", "/music/new"])).toEqual([
    "/music/b",
    "/music/a",
    "/music/new",
  ]);
  expect(JSON.stringify([...data])).not.toContain("/music/");
  expect(
    await order.read({ ...owner, server: "http://127.0.0.1:9001" }, ["/music/a", "/music/b"]),
  ).toEqual(["/music/b", "/music/a"]);
  expect(
    await order.read({ ...owner, account: { ...owner.account, id: "bob" } }, [
      "/music/a",
      "/music/b",
    ]),
  ).toEqual(["/music/a", "/music/b"]);
});
it("preserves corrupt order bytes and blocks writes, and drops retired admissions", async () => {
  const { order, data } = fixture();
  await order.save(owner, ["/music/a"], () => true);
  const key = [...data.keys()][0]!;
  data.set(key, "{broken");
  await expect(order.save(owner, ["/music/b"], () => true)).rejects.toThrow();
  expect(data.get(key)).toBe("{broken");
  await order.save(owner, ["/music/c"], () => false);
  expect(data.get(key)).toBe("{broken");
});
it("reports a refused write while retaining the prior confirmed order", async () => {
  const { storage, order } = fixture();
  await order.save(owner, ["/music/b", "/music/a"], () => true);
  const refused = createExcludedFolderOrder({
    ...storage,
    setItem: () => {
      throw new Error("Quota");
    },
  });
  await expect(refused.save(owner, ["/music/a", "/music/b"], () => true)).rejects.toThrow("Quota");
  expect(await order.read(owner, ["/music/a", "/music/b"])).toEqual(["/music/b", "/music/a"]);
});

import { createRoot, createSignal } from "solid-js";
import { expect, it, vi, afterEach } from "vitest";
import { requestAede } from "../platform/desktop";
import { createAchievementLoading } from "./achievement-loading";
import type { AccountSession } from "./server";
import type { SourceId } from "./sources";
vi.mock("../platform/desktop", () => ({ requestAede: vi.fn() }));
afterEach(() => vi.resetAllMocks());
const account = (): AccountSession => ({
  server: "https://fixture.example",
  account: { id: "one", username: "one", role: "user" },
});
const capability = { capabilities: ["private_achievements"] };
const trophies = { items: [{ slot: 0, unlocked_at: null }], total: 1, unlocked: 0 };
const settle = async () => {
  for (let i = 0; i < 16; i++) await Promise.resolve();
};
it.each(["logout", "relogin", "source"])(
  "never starts an unlock write for a replaced scope after pending status: %s",
  async (change) => {
    let finish!: (value: unknown) => void;
    vi.mocked(requestAede)
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finish = resolve;
          }),
      )
      .mockImplementation(async (path) => (path === "/api/v1/status" ? capability : trophies));
    const [session, setSession] = createSignal<AccountSession | undefined>(account());
    const [source, setSource] = createSignal<SourceId>("server");
    let dispose!: () => void;
    const loaded = createRoot((cleanup) => {
      dispose = cleanup;
      return createAchievementLoading(session, source);
    });
    try {
      await settle();
      if (change === "source") setSource("local");
      else setSession(change === "logout" ? undefined : account());
      await settle();
      const before = vi.mocked(requestAede).mock.calls.filter((call) => call[2] === "POST");
      finish(capability);
      await settle();
      expect(vi.mocked(requestAede).mock.calls.filter((call) => call[2] === "POST")).toEqual(
        before,
      );
      expect(loaded.current()).toEqual(change === "logout" ? undefined : trophies);
    } finally {
      dispose();
    }
  },
);
it("uses GET for auditors and keeps request failures local for explicit retry", async () => {
  const owner = account();
  owner.account.role = "auditor";
  vi.mocked(requestAede)
    .mockResolvedValueOnce(capability)
    .mockRejectedValueOnce(new Error("Unavailable"))
    .mockResolvedValueOnce(capability)
    .mockResolvedValueOnce(trophies);
  let dispose!: () => void;
  const loaded = createRoot((cleanup) => {
    dispose = cleanup;
    return createAchievementLoading(
      () => owner,
      () => "local",
    );
  });
  try {
    await settle();
    expect(() => loaded.current()).not.toThrow();
    expect(loaded.error()).toContain("Unavailable");
    await loaded.refetch();
    await settle();
    expect(loaded.current()).toEqual(trophies);
    expect(
      vi
        .mocked(requestAede)
        .mock.calls.filter((call) => call[0].endsWith("/achievements"))
        .map((call) => [call[2], call[4]]),
    ).toEqual([
      ["GET", "local"],
      ["GET", "local"],
    ]);
  } finally {
    dispose();
  }
});
it("does not start an unlock write after the view is disposed during status", async () => {
  let finish!: (value: unknown) => void;
  vi.mocked(requestAede)
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    )
    .mockResolvedValue(trophies);
  let dispose!: () => void;
  const loaded = createRoot((cleanup) => {
    dispose = cleanup;
    return createAchievementLoading(account, () => "server");
  });
  await settle();
  dispose();
  finish(capability);
  await settle();
  expect(vi.mocked(requestAede).mock.calls.filter((call) => call[2] === "POST")).toHaveLength(0);
  expect(loaded.current()).toBeUndefined();
});

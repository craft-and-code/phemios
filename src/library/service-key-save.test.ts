import { expect, it, vi } from "vitest";
import { completeServiceKeySave } from "./service-key-save";
it.each(["save", "refresh"])(
  "does not mutate a replacement profile after pending %s",
  async (stage) => {
    let active = true,
      finish!: () => void;
    const pending = new Promise<void>((resolve) => {
      finish = resolve;
    });
    const commit = vi.fn(),
      refresh = vi.fn(() => (stage === "refresh" ? pending : Promise.resolve()));
    const work = completeServiceKeySave({
      current: () => active,
      save: () => (stage === "save" ? pending : Promise.resolve()),
      refresh,
      commit,
    });
    await Promise.resolve();
    active = false;
    finish();
    await work;
    expect(commit).not.toHaveBeenCalled();
    if (stage === "save") expect(refresh).not.toHaveBeenCalled();
  },
);
it("commits a current native save after refreshing its status", async () => {
  const events: string[] = [];
  await completeServiceKeySave({
    current: () => true,
    save: async () => {
      events.push("save");
    },
    refresh: async () => {
      events.push("refresh");
    },
    commit: () => {
      events.push("commit");
    },
  });
  expect(events).toEqual(["save", "refresh", "commit"]);
});

it.each(["save", "refresh"])(
  "preserves a failed %s without applying enrichment preferences",
  async (stage) => {
    const commit = vi.fn();
    const fail = async () => {
      throw new Error("native key operation refused");
    };
    await expect(
      completeServiceKeySave({
        current: () => true,
        save: stage === "save" ? fail : async () => {},
        refresh: stage === "refresh" ? fail : async () => {},
        commit,
      }),
    ).rejects.toThrow("native key operation refused");
    expect(commit).not.toHaveBeenCalled();
  },
);

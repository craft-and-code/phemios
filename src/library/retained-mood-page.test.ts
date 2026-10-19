import { expect, it } from "vitest";
import { retainedMoodPage, type MoodReply } from "./retained-mood-page";
import type { AccountSession } from "./server";
const owner = {} as AccountSession;
const reply: MoodReply = {
  session: owner,
  source: "local",
  selected: "calm",
  offset: 0,
  audio: true,
  extractable: true,
  page: { moods: [], items: [], total: 0, offset: 0, scanned_at: 1 },
};
it("keeps confirmed rows and does not enter Suspense during task progress refresh", () => {
  const resource = Object.assign(
    () => {
      throw new Error("pending read would replace the whole view");
    },
    { latest: reply },
  );
  expect(retainedMoodPage(resource, reply)).toBe(reply.page);
});
it("does not retain personal rows after owner, source or selection changes", () => {
  const resource = Object.assign(() => reply, { latest: reply });
  for (const key of [
    { ...reply, session: {} as AccountSession },
    { ...reply, source: "server" as const },
    { ...reply, selected: "energy" },
    { ...reply, offset: 50 },
  ])
    expect(retainedMoodPage(resource, key)).toBeUndefined();
});

it("rejects a former login generation even when the session object is reused", () => {
  const old = { ...reply, owner: {} };
  const resource = Object.assign(() => old, { latest: old });
  expect(retainedMoodPage(resource, { ...reply, owner: {} })).toBeUndefined();
});

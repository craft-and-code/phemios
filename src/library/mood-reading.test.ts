import { afterEach, expect, it, vi } from "vitest";
import { readMoodReply } from "./mood-reading";
import { requestAede } from "../platform/desktop";
vi.mock("../platform/desktop", () => ({ requestAede: vi.fn() }));
afterEach(() => vi.resetAllMocks());
const key = {
  session: {
    server: "https://music.example",
    account: { id: "one", username: "one", role: "user" },
  },
  source: "server" as const,
  selected: "",
  offset: 0,
  expected: "",
};
it("does not issue the private mood page after its capability read is retired", async () => {
  let current = true;
  vi.mocked(requestAede).mockImplementation(async (path) => {
    if (path === "/api/v1/status") {
      current = false;
      return { capabilities: ["mood_rules"] };
    }
    return { moods: [], items: [], total: 0, offset: 0, scanned_at: 1 };
  });
  await readMoodReply(key, () => current);
  expect(requestAede).toHaveBeenCalledTimes(1);
});

it("binds capability and private page requests to the captured owner", async () => {
  vi.mocked(requestAede)
    .mockResolvedValueOnce({ capabilities: ["mood_rules", "mood_audio_features"] })
    .mockResolvedValueOnce({ moods: [], items: [], total: 0, offset: 50, scanned_at: 1 });
  const result = await readMoodReply(
    { ...key, selected: "calm", offset: 50, expected: "revision" },
    () => true,
  );
  expect(result?.page.offset).toBe(50);
  expect(requestAede).toHaveBeenLastCalledWith(
    "/api/me/v1/moods",
    { mood: "calm", offset: "50", limit: "50", audio: "true", revision: "revision" },
    "GET",
    null,
    "server",
    key.session,
  );
});
it("does no request for a retired reader and reports malformed current pages", async () => {
  await readMoodReply(key, () => false);
  expect(requestAede).not.toHaveBeenCalled();
  vi.mocked(requestAede)
    .mockResolvedValueOnce({ capabilities: ["mood_rules"] })
    .mockResolvedValueOnce({});
  await expect(readMoodReply(key, () => true)).rejects.toThrow();
});

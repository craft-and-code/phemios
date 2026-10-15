import { expect, it } from "vitest";
import {
  parseParentalPolicy,
  parseParentalPolicySnapshot,
  parseParentalStatus,
  parentalPodcastFeed,
} from "./parental-controls";
import { parentalSnapshot, parentalStatus } from "./parental-test-fixtures";
it("retains seven civil days, closed days, explicit zero and unlimited quotas without sharing editable arrays", () => {
  const raw = parentalSnapshot();
  raw.policy.days[0] = { windows: [], limit_seconds: 0 };
  raw.policy.days[1] = {
    windows: [
      { start_minute: 0, end_minute: 60 },
      { start_minute: 1380, end_minute: 1440 },
    ],
    limit_seconds: 3600,
  };
  const parsed = parseParentalPolicySnapshot(raw, "child");
  expect(parsed).toEqual(raw);
  parsed.policy.days[1]!.windows[0]!.end_minute = 30;
  expect(raw.policy.days[1]!.windows[0]!.end_minute).toBe(60);
  expect(parsed.policy.week_limit_seconds).toBeNull();
  expect(() => parseParentalPolicySnapshot(raw, "other")).toThrow();
});
it("rejects invalid clocks, overlapping or overnight windows and malformed limits", () => {
  for (const policy of [
    { ...parentalSnapshot().policy, timezone: "Invented/Clock" },
    { ...parentalSnapshot().policy, days: [] },
    { ...parentalSnapshot().policy, week_limit_seconds: -1 },
    {
      ...parentalSnapshot().policy,
      days: Array(7).fill({ windows: [{ start_minute: 90, end_minute: 60 }], limit_seconds: null }),
    },
    {
      ...parentalSnapshot().policy,
      days: Array(7).fill({
        windows: [
          { start_minute: 0, end_minute: 120 },
          { start_minute: 60, end_minute: 180 },
        ],
        limit_seconds: null,
      }),
    },
    {
      ...parentalSnapshot().policy,
      days: Array(7).fill({
        windows: [{ start_minute: 0, end_minute: 1441 }],
        limit_seconds: null,
      }),
    },
    {
      ...parentalSnapshot().policy,
      days: Array(7).fill({
        windows: Array(9).fill({ start_minute: 0, end_minute: 1 }),
        limit_seconds: null,
      }),
    },
    { ...parentalSnapshot().policy, days: Array(7).fill({ windows: [], limit_seconds: 1.5 }) },
  ])
    expect(() => parseParentalPolicy(policy)).toThrow();
});
it("bounds artist identities and RSS exclusions and rejects ambiguous source qualifiers and credentials", () => {
  const base = parentalSnapshot().policy;
  expect(
    parseParentalPolicy({
      ...base,
      blocked_artists: ["artist:example"],
      blocked_podcasts: ["https://example.invalid/feed.xml"],
    }).blocked_artists,
  ).toEqual(["artist:example"]);
  for (const changed of [
    { blocked_artists: ["artist:@phemios/local/example"] },
    { blocked_artists: ["artist:a", "artist:a"] },
    { blocked_artists: Array.from({ length: 257 }, (_, i) => `artist:${i}`) },
    { blocked_podcasts: ["file:///feed.xml"] },
    { blocked_podcasts: ["https://user:secret@example.invalid/feed"] },
    { blocked_podcasts: Array.from({ length: 129 }, (_, i) => `https://example.invalid/${i}`) },
  ])
    expect(() => parseParentalPolicy({ ...base, ...changed })).toThrow();
});
it("admits server status only with a valid owner, revision and explicit refusal reason", () => {
  const raw = parentalStatus();
  expect(parseParentalStatus(raw)).toEqual(raw);
  expect(
    parseParentalStatus({
      ...raw,
      allowed: false,
      reason: "outside_schedule",
      next_change_at: 1234,
      remaining_seconds: 0,
    }).reason,
  ).toBe("outside_schedule");
  for (const changed of [
    { owner: "" },
    { revision: -1 },
    { remaining_seconds: -1 },
    { day_used_seconds: 1.2 },
    { allowed: false },
    { reason: "unknown" },
    { reason: "daily_limit" },
    { next_change_at: NaN },
  ])
    expect(() => parseParentalStatus({ ...raw, ...changed })).toThrow();
});

it("canonicalizes inert feed restrictions without introducing a media or network dependency", () => {
  expect(parentalPodcastFeed(" HTTPS://EXAMPLE.INVALID/feed#episode ")).toBe(
    "https://example.invalid/feed",
  );
  for (const value of ["file:///feed", "https://user:secret@example.invalid/feed", "not a URL"])
    expect(() => parentalPodcastFeed(value)).toThrow();
});

it("measures RSS and artist limits in UTF-8 bytes like the engine", () => {
  const base = parentalSnapshot().policy;
  const artist = `artist:${"é".repeat(8188)}a`;
  const prefix = "https://example.invalid/";
  const feed = prefix + "a".repeat(2048 - prefix.length);
  expect(new TextEncoder().encode(artist)).toHaveLength(16384);
  expect(parseParentalPolicy({ ...base, blocked_artists: [artist] }).blocked_artists).toEqual([
    artist,
  ]);
  expect(parseParentalPolicy({ ...base, blocked_podcasts: [feed] }).blocked_podcasts).toEqual([
    feed,
  ]);
  expect(parentalPodcastFeed(feed)).toBe(feed);
  for (const value of [feed + "a", prefix + "é".repeat(1013)]) {
    expect(() => parseParentalPolicy({ ...base, blocked_podcasts: [value] })).toThrow();
    expect(() => parentalPodcastFeed(value)).toThrow();
  }
  expect(() => parseParentalPolicy({ ...base, blocked_artists: [artist + "é"] })).toThrow();
});

it("keeps legacy podcast permission and validates the new global switch and administrator lock", () => {
  const legacy = { ...parentalSnapshot().policy } as Record<string, unknown>;
  delete legacy.podcasts_allowed;
  expect(parseParentalPolicy(legacy).podcasts_allowed).toBe(true);
  expect(parseParentalPolicy({ ...legacy, podcasts_allowed: false }).podcasts_allowed).toBe(false);
  expect(() => parseParentalPolicy({ ...legacy, podcasts_allowed: "no" })).toThrow();
  expect(
    parseParentalPolicySnapshot({ ...parentalSnapshot(), locked_by: "parent" }).locked_by,
  ).toBe("parent");
  for (const locked_by of ["", true, 42])
    expect(() => parseParentalPolicySnapshot({ ...parentalSnapshot(), locked_by })).toThrow();
});

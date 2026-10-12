import { expect, it } from "vitest";
import { podcastDuration, podcastUrl, validatedPodcast } from "./feed";
import { feed } from "./test-fixtures";

it("reads finite podcast clocks while preserving invalid and absent durations as unknown", () => {
  expect(podcastDuration("1:02:03")).toBe(3723);
  expect(podcastDuration("12:34")).toBe(754);
  expect(podcastDuration("120")).toBe(120);
  for (const n of ["", "0", "1:60", "text", "-4", "86401"]) expect(podcastDuration(n)).toBeNull();
});
it("rejects file/credential/private URLs and malformed retained episodes", () => {
  for (const url of [
    "file:///one.mp3",
    "https://user:secret@example.org/audio",
    "http://127.0.0.1/one",
    "http://192.168.1.1/a",
    "javascript:alert(1)",
    "https://example.org:8443/audio",
  ])
    expect(() => podcastUrl(url)).toThrow();
  expect(podcastUrl("one.mp3", "https://example.org/feed.xml")).toBe("https://example.org/one.mp3");
  expect(validatedPodcast(feed)).toEqual(feed);
  for (const episode of [
    { ...feed.episodes[0], duration: -1 },
    { ...feed.episodes[0], date: "Invalid" },
    { ...feed.episodes[0], url: "file:///music.flac" },
  ])
    expect(() => validatedPodcast({ ...feed, episodes: [episode] })).toThrow();
  expect(() =>
    validatedPodcast({ ...feed, episodes: [feed.episodes[0], feed.episodes[0]] }),
  ).toThrow();
});

it("refuses non-public numeric aliases, reserved ranges and local host suffixes before browser audio", () => {
  for (const url of [
    "http://100.64.0.1/audio",
    "http://100.127.255.254/audio",
    "http://198.18.0.1/audio",
    "http://192.0.2.1/audio",
    "http://198.51.100.1/audio",
    "http://203.0.113.1/audio",
    "http://224.0.0.1/audio",
    "http://240.0.0.1/audio",
    "http://localhost./audio",
    "http://host.localhost/audio",
    "http://host.local./audio",
    "http://2130706433/audio",
    "http://0x7f000001/audio",
    "http://0177.0.0.1/audio",
  ])
    expect(() => podcastUrl(url)).toThrow();
  expect(podcastUrl("https://1.1.1.1/audio")).toBe("https://1.1.1.1/audio");
});

it("refuses protocol-only and retired relay literals while preserving public anycast addresses", () => {
  for (const host of [
    "192.0.0.0",
    "192.0.0.1",
    "192.0.0.8",
    "192.0.0.170",
    "192.0.0.171",
    "192.0.0.255",
    "192.88.99.1",
    "192.88.99.2",
  ])
    expect(() => podcastUrl(`https://${host}/audio`)).toThrow();
  for (const host of ["192.0.0.9", "192.0.0.10"])
    expect(podcastUrl(`https://${host}/audio`)).toBe(`https://${host}/audio`);
});

it("normalizes parseable dates before private persistence while preserving null and signed ISO years", () => {
  for (const [date, expected] of [
    [null, null],
    ["Thu, 29 Feb 2024 12:34:56 GMT", "2024-02-29T12:34:56.000Z"],
    ["+010000-01-01T00:00:00.000Z", "+010000-01-01T00:00:00.000Z"],
    ["-000001-01-01T00:00:00.000Z", "-000001-01-01T00:00:00.000Z"],
  ]) {
    expect(
      validatedPodcast({ ...feed, episodes: [{ ...feed.episodes[0], date }] }).episodes[0]?.date,
    ).toBe(expected);
  }
});

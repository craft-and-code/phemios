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

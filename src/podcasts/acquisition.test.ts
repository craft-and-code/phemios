import { expect, it, vi } from "vitest";
import { acquirePodcastFeed } from "./acquisition";
const apple = "https://podcasts.apple.com/fr/podcast/show/id1678105148?i=1000797892417";
const feed = "https://feeds.example.org/podcast.xml";
function setup() {
  let current = true;
  const resolve = vi.fn(async () => feed),
    read = vi.fn(async () => "<rss/>"),
    allowed = vi.fn(() => true);
  return {
    resolve,
    read,
    allowed,
    current: () => current,
    retire: () => {
      current = false;
    },
  };
}
it("resolves an Apple episode to its podcast before checking its RSS policy", async () => {
  const io = setup();
  expect(await acquirePodcastFeed(apple, io)).toEqual({ url: feed, xml: "<rss/>" });
  expect(io.resolve).toHaveBeenCalledWith(apple);
  expect(io.allowed).toHaveBeenCalledWith(feed);
  expect(io.read).toHaveBeenCalledWith(feed);
});
it("keeps ordinary RSS refresh independent of Apple", async () => {
  const io = setup();
  expect(await acquirePodcastFeed(feed, io)).toEqual({ url: feed, xml: "<rss/>" });
  expect(io.resolve).not.toHaveBeenCalled();
});
it("does not fetch or publish after account retirement during lookup", async () => {
  const io = setup();
  io.resolve.mockImplementation(async () => {
    io.retire();
    return feed;
  });
  expect(await acquirePodcastFeed(apple, io)).toBeUndefined();
  expect(io.read).not.toHaveBeenCalled();
});
it("checks the resolved RSS against blocked podcast addresses", async () => {
  const io = setup();
  io.allowed.mockReturnValue(false);
  await expect(acquirePodcastFeed(apple, io)).rejects.toThrow("masqué");
  expect(io.read).not.toHaveBeenCalled();
});
it("rejects unsafe resolved addresses before a feed request", async () => {
  const io = setup();
  io.resolve.mockResolvedValue("http://127.0.0.1/feed");
  await expect(acquirePodcastFeed(apple, io)).rejects.toThrow();
  expect(io.read).not.toHaveBeenCalled();
});
it("discards a late RSS response and never starts work for a retired owner", async () => {
  const io = setup();
  io.read.mockImplementation(async () => {
    io.retire();
    return "<rss/>";
  });
  expect(await acquirePodcastFeed(feed, io)).toBeUndefined();
  io.resolve.mockClear();
  io.read.mockClear();
  expect(await acquirePodcastFeed(apple, io)).toBeUndefined();
  expect(io.resolve).not.toHaveBeenCalled();
  expect(io.read).not.toHaveBeenCalled();
});

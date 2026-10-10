import { createSignal } from "solid-js";
import type { Podcast } from "./feed";
/** Capture the intended feed before confirmation; cancellation cannot mutate retained subscriptions. */
export function createUnsubscribe(remove: (url: string) => boolean) {
  const [pending, setPending] = createSignal<Pick<Podcast, "url" | "title">>();
  return {
    pending,
    ask: (feed: Pick<Podcast, "url" | "title">) => setPending({ url: feed.url, title: feed.title }),
    cancel: () => setPending(undefined),
    confirm() {
      const feed = pending();
      if (!feed || !remove(feed.url)) return false;
      setPending(undefined);
      return true;
    },
  };
}

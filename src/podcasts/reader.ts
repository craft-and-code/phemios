import { createEffect, createSignal, on, onCleanup, type Accessor } from "solid-js";
import { acquirePodcastFeed } from "./acquisition";
import { parsePodcastFeed, type Podcast } from "./feed";
/** One explicit acquisition retains its login, cancellation and current subscription selection. */
export function createPodcastReader(options: {
  owner: Accessor<unknown>;
  selected: Accessor<string>;
  writable: () => boolean;
  capture: () => {
    current: () => boolean;
    save: (feed: Podcast, current: () => boolean) => Promise<boolean>;
  };
  resolve: (url: string) => Promise<string>;
  read: (url: string) => Promise<string>;
  allowed: (url: string) => boolean;
  saved: (feed: Podcast) => void;
  decode?: typeof parsePodcastFeed;
}) {
  const [busy, setBusy] = createSignal<"" | "subscribe" | "refresh">(""),
    [error, setError] = createSignal("");
  let revision = 0,
    alive = true;
  function cancel() {
    revision++;
    setBusy("");
  }
  createEffect(
    on(
      options.owner,
      () => {
        cancel();
        setError("");
      },
      { defer: true },
    ),
  );
  createEffect(
    on(
      options.selected,
      () => {
        if (busy() === "refresh") cancel();
      },
      { defer: true },
    ),
  );
  onCleanup(() => {
    alive = false;
    cancel();
  });
  async function load(value: string, action: "subscribe" | "refresh" = "subscribe") {
    if (busy() || !options.writable()) return;
    const actor = options.capture(),
      ticket = ++revision,
      owner = options.owner(),
      selected = options.selected();
    const current = () =>
      alive &&
      owner === options.owner() &&
      actor.current() &&
      ticket === revision &&
      (action !== "refresh" || selected === options.selected());
    setBusy(action);
    setError("");
    try {
      const result = await acquirePodcastFeed(value, {
        resolve: options.resolve,
        read: options.read,
        current,
        allowed: options.allowed,
      });
      if (!result) return;
      const data = (options.decode ?? parsePodcastFeed)(result.xml, result.url);
      if ((await actor.save(data, current)) && current()) options.saved(data);
    } catch (failure) {
      if (current()) setError(String(failure));
    } finally {
      if (current()) setBusy("");
    }
  }
  return { busy, error, cancel, load };
}

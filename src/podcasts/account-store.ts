import { createEffect, createMemo, createSignal, onCleanup } from "solid-js";
import { t } from "../i18n";
import { readPodcastState, updatePodcastState } from "../platform/desktop";
import type { AccountSession } from "../library/server";
import type { SourceId } from "../library/sources";
import { podcastUrl, validatedPodcast, type Podcast } from "./feed";
interface State {
  feeds: Podcast[];
  episodes: { feed: string; id: string }[];
}
function parse(raw: unknown): State {
  const value = raw as State;
  if (
    !value ||
    !Array.isArray(value.feeds) ||
    value.feeds.length > 100 ||
    !Array.isArray(value.episodes) ||
    value.episodes.length > 4096
  )
    throw new Error(t("Abonnements podcasts illisibles."));
  const feeds = value.feeds.map(validatedPodcast);
  const episodes = value.episodes.map((row) => {
    if (
      !row ||
      typeof row.feed !== "string" ||
      typeof row.id !== "string" ||
      !row.id.trim() ||
      row.id.length > 4096
    )
      throw new Error(t("Épisodes écoutés illisibles."));
    return { feed: podcastUrl(row.feed), id: row.id };
  });
  if (
    new Set(feeds.map((row) => row.url)).size !== feeds.length ||
    new Set(episodes.map((row) => JSON.stringify([row.feed, row.id]))).size !== episodes.length ||
    [feeds, episodes].some(
      (rows) => new TextEncoder().encode(JSON.stringify(rows)).byteLength > 4 * 1024 * 1024,
    )
  )
    throw new Error(t("Abonnements podcasts illisibles."));
  return { feeds, episodes };
}
/** No legacy device store is read; scopes admit exact sessions and serialize narrow native mutations. */
export function createAccountPodcasts(
  session: () => AccountSession | undefined,
  source: () => SourceId,
) {
  const scope = createMemo(() => {
    const owner = session();
    return owner ? { owner, source: source() } : undefined;
  });
  type Scope = NonNullable<ReturnType<typeof scope>>;
  const [row, setRow] = createSignal<{ scope: Scope; data: State }>();
  const [error, setError] = createSignal("");
  const [loading, setLoading] = createSignal(false);
  const [pending, setPending] = createSignal(false);
  let alive = true,
    tail: Promise<unknown> = Promise.resolve();
  const current = (held: Scope | undefined) => alive && !!held && scope() === held;
  const admitted = () => (current(row()?.scope) ? row()?.data : undefined);
  createEffect(() => {
    const held = scope();
    setError("");
    setLoading(!!held);
    setPending(false);
    if (!held) return;
    void readPodcastState(held.source, held.owner)
      .then((raw) => {
        if (current(held)) setRow({ scope: held, data: parse(raw) });
      })
      .catch((failure) => {
        if (current(held)) setError(String(failure));
      })
      .finally(() => {
        if (current(held)) setLoading(false);
      });
  });
  onCleanup(() => {
    alive = false;
  });
  function capture() {
    const held = scope(),
      active = () => current(held);
    async function update(action: "save" | "remove" | "mark", payload: unknown) {
      if (
        !held ||
        !active() ||
        loading() ||
        !admitted() ||
        !["user", "admin"].includes(held.owner.account.role)
      )
        return false;
      const work = tail.then(async () => {
        if (!active()) return false;
        setPending(true);
        setError("");
        try {
          const raw = await updatePodcastState(action, payload, held.source, held.owner);
          if (!active()) return false;
          setRow({ scope: held, data: parse(raw) });
          return true;
        } catch (failure) {
          if (active()) setError(String(failure));
          return false;
        } finally {
          if (active()) setPending(false);
        }
      });
      tail = work;
      return work;
    }
    return {
      current: active,
      save: (feed: Podcast) => update("save", validatedPodcast(feed)),
      remove: (url: string) => update("remove", podcastUrl(url)),
      mark: (feed: string, id: string) => update("mark", { feed: podcastUrl(feed), id }),
    };
  }
  return {
    feeds: () => admitted()?.feeds ?? [],
    has: (feed: string, id: string) =>
      admitted()?.episodes.some((row) => row.feed === feed && row.id === id) ?? false,
    error,
    loading,
    pending,
    capture,
    ready: () => !!admitted(),
    writable: () =>
      !!admitted() && !loading() && ["user", "admin"].includes(scope()?.owner.account.role ?? ""),
    save: (feed: Podcast) => capture().save(feed),
    remove: (url: string) => capture().remove(url),
    mark: (feed: string, id: string) => capture().mark(feed, id),
  };
}

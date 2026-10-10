import { createSignal, For, Show, onCleanup } from "solid-js";
import { t, locale } from "../i18n";
import { useLibrary } from "../library/context";
import { readPodcastFeed, isNative } from "../platform/desktop";
import { parsePodcastFeed, podcastUrl } from "../podcasts/feed";
import { createSubscriptions } from "../podcasts/subscriptions";
import { Icon } from "../components/Icon";
import { EmptyState } from "../components/EmptyState";
/** RSS subscriptions stay usable offline; adding/updating is explicit and never starts an episode. */
export function PodcastsPage(props: { query: string }) {
  const library = useLibrary(),
    subscriptions = createSubscriptions(),
    [url, setUrl] = createSignal(""),
    [selected, setSelected] = createSignal(subscriptions.feeds()[0]?.url ?? ""),
    [busy, setBusy] = createSignal<"" | "subscribe" | "refresh">(""),
    [error, setError] = createSignal("");
  let alive = true;
  onCleanup(() => {
    alive = false;
  });
  const feed = () => subscriptions.feeds().find((f) => f.url === selected());
  const episodes = () =>
    (feed()?.episodes ?? []).filter((e) =>
      `${e.title} ${e.summary}`.toLocaleLowerCase().includes(props.query.toLocaleLowerCase()),
    );
  async function load(value: string, action: "subscribe" | "refresh" = "subscribe") {
    if (busy()) return;
    setBusy(action);
    setError("");
    try {
      const source = podcastUrl(value.trim()),
        xml = await readPodcastFeed(source);
      if (!alive) return;
      const data = parsePodcastFeed(xml, source);
      if (subscriptions.save(data)) {
        setSelected(data.url);
        setUrl("");
      }
    } catch (e) {
      if (alive) setError(String(e));
    } finally {
      if (alive) setBusy("");
    }
  }
  return (
    <section class="page podcasts-page">
      <form
        class="podcast-add"
        onSubmit={(e) => {
          e.preventDefault();
          void load(url());
        }}
      >
        <label>
          {t("Lien RSS du podcast")}
          <input
            type="url"
            required
            placeholder="https://example.org/podcast.xml"
            value={url()}
            onInput={(e) => setUrl(e.currentTarget.value)}
            disabled={!!busy()}
          />
        </label>
        <button class="primary" disabled={!!busy() || !isNative()}>
          {t("S’abonner")}
        </button>
        <Show when={busy() === "subscribe"}>
          <span class="job-activity" role="status">
            <span class="spinner" aria-hidden="true" />
            {t("Chargement du podcast…")}
          </span>
        </Show>
      </form>
      <Show when={error() || subscriptions.error()}>
        <p role="alert">{error() || subscriptions.error()}</p>
      </Show>
      <Show
        when={subscriptions.feeds().length}
        fallback={<EmptyState icon="podcast">{t("Aucun podcast enregistré.")}</EmptyState>}
      >
        <div class="podcast-library">
          <nav aria-label={t("Abonnements podcasts")}>
            <For each={subscriptions.feeds()}>
              {(row) => (
                <button aria-pressed={row.url === selected()} onClick={() => setSelected(row.url)}>
                  <Icon name="podcast" />
                  <span>
                    {row.title}
                    <small>{row.author}</small>
                  </span>
                </button>
              )}
            </For>
          </nav>
          <Show when={feed()}>
            {(current) => (
              <section class="podcast-episodes">
                <div class="section-heading">
                  <h2>{current().title}</h2>
                  <button
                    class="icon-button"
                    disabled={!!busy() || !isNative()}
                    aria-busy={busy() === "refresh"}
                    aria-label={t("Actualiser les épisodes")}
                    title={t("Actualiser les épisodes")}
                    onClick={() => void load(current().url, "refresh")}
                  >
                    <Show when={busy() === "refresh"} fallback={<Icon name="refresh" />}>
                      <span class="spinner" aria-hidden="true" />
                      <span class="sr-only" role="status">
                        {t("Chargement du podcast…")}
                      </span>
                    </Show>
                  </button>
                  <button
                    class="icon-button quiet icon-close"
                    disabled={!!busy()}
                    aria-label={t("Se désabonner")}
                    title={t("Se désabonner")}
                    onClick={() => {
                      if (subscriptions.remove(current().url))
                        setSelected(subscriptions.feeds()[0]?.url ?? "");
                    }}
                  >
                    <Icon name="close" />
                  </button>
                </div>
                <ul>
                  <For each={episodes()}>
                    {(row) => (
                      <li>
                        <div>
                          <strong>{row.title}</strong>
                          <small>
                            {row.date ? new Date(row.date).toLocaleDateString(locale()) : ""}
                            {row.duration
                              ? ` · ${Math.floor(row.duration / 60)}:${String(Math.floor(row.duration % 60)).padStart(2, "0")}`
                              : ""}
                          </small>
                          <Show when={row.summary}>
                            <p>{row.summary}</p>
                          </Show>
                        </div>
                        <button
                          class="icon-button"
                          aria-label={t("Lire {0}", row.title)}
                          title={t("Lire {0}", row.title)}
                          onClick={() => void library.podcast.start(current(), row)}
                        >
                          <Icon name="play" />
                        </button>
                      </li>
                    )}
                  </For>
                </ul>
                <Show when={!episodes().length}>
                  <EmptyState icon="podcast">{t("Aucun épisode dans cette sélection.")}</EmptyState>
                </Show>
              </section>
            )}
          </Show>
        </div>
      </Show>
    </section>
  );
}

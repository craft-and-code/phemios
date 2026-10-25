import { StickyHeader } from "../components/StickyHeader";
import { PodcastSubscribeForm } from "../components/PodcastSubscribeForm";
import { DownloadButton } from "../components/DownloadButton";
import { AccountNotice } from "../components/AccountNotice";
import { PageLoader } from "../components/PageLoader";
import { Feedback } from "../components/Feedback";
import { createSignal, createMemo, createEffect, on, For, Show, onCleanup } from "solid-js";
import { t, locale } from "../i18n";
import { useLibrary } from "../library/context";
import { createEpisodeDownloads } from "../podcasts/downloads";
import {
  readPodcastFeed,
  resolvePodcastFeed,
  downloadPodcastEpisode,
  isNative,
} from "../platform/desktop";
import { parsePodcastFeed } from "../podcasts/feed";
import { Icon } from "../components/Icon";
import { acquirePodcastFeed } from "../podcasts/acquisition";
import { EmptyState } from "../components/EmptyState";
/** RSS subscriptions stay usable offline; adding/updating is explicit and never starts an episode. */
export function PodcastsPage(props: { query: string }) {
  const library = useLibrary(),
    subscriptions = library.podcastSubscriptions,
    [url, setUrl] = createSignal(""),
    [selected, setSelected] = createSignal(subscriptions.feeds()[0]?.url ?? ""),
    [busy, setBusy] = createSignal<"" | "subscribe" | "refresh">(""),
    [error, setError] = createSignal("");
  const owner = createMemo(() => ({ session: library.session(), source: library.source() }));
  const downloads = createEpisodeDownloads(async (url, title) => {
    if (!library.parental.available() || library.parental.status()?.policy.enabled)
      throw Error(t("Le téléchargement des épisodes est indisponible pour un compte supervisé."));
    return downloadPodcastEpisode(url, title);
  }, owner);
  type Actor = ReturnType<typeof subscriptions.capture>;
  const [removal, setRemoval] = createSignal<{ url: string; title: string; actor: Actor }>();
  const unsubscribe = {
    pending: () => (removal()?.actor.current() ? removal() : undefined),
    cancel: () => setRemoval(undefined),
    ask: (feed: { url: string; title: string }) =>
      setRemoval({ ...feed, actor: subscriptions.capture() }),
    async confirm() {
      const held = removal();
      if (!held || !held.actor.current()) return;
      if ((await held.actor.remove(held.url)) && held.actor.current() && removal() === held) {
        setRemoval(undefined);
        setSelected(subscriptions.feeds()[0]?.url ?? "");
      }
    },
  };
  createEffect(
    on(owner, () => {
      setUrl("");
      setSelected("");
      setBusy("");
      setError("");
      unsubscribe.cancel();
    }),
  );
  createEffect(() => {
    const rows = subscriptions.feeds();
    if (!rows.some((row) => row.url === selected())) setSelected(rows[0]?.url ?? "");
  });
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
    if (busy() || !subscriptions.writable()) return;
    const actor = subscriptions.capture();
    setBusy(action);
    setError("");
    try {
      const result = await acquirePodcastFeed(value, {
        resolve: resolvePodcastFeed,
        read: readPodcastFeed,
        current: () => alive && actor.current(),
        allowed: (source) => library.parental.podcastAllowed(source),
      });
      if (!result) return;
      const data = parsePodcastFeed(result.xml, result.url);
      if ((await actor.save(data)) && alive && actor.current()) {
        setSelected(data.url);
        setUrl("");
      }
    } catch (e) {
      if (alive && actor.current()) setError(String(e));
    } finally {
      if (alive && actor.current()) setBusy("");
    }
  }
  return (
    <section class="page result-page podcasts-page">
      <Show when={subscriptions.loading()}>
        <PageLoader />
      </Show>
      <StickyHeader visible={!!library.session()}>
        <PodcastSubscribeForm
          url={url()}
          busy={busy() === "subscribe"}
          disabled={!!busy() || !isNative() || !subscriptions.writable()}
          onInput={setUrl}
          onSubscribe={() => void load(url())}
        />
      </StickyHeader>
      <AccountNotice />
      <Show when={error() || subscriptions.error() || library.podcastListened.error()}>
        <Feedback
          error
          message={error() || subscriptions.error() || library.podcastListened.error()}
        />
      </Show>
      <Feedback
        message={downloads.message()}
        error={downloads.failed()}
        onClose={downloads.dismiss}
      />
      <Show when={downloads.busy()}>
        <p class="job-activity" role="status">
          <span class="spinner" aria-hidden="true" />
          {t("Téléchargement de l’épisode…")}
        </p>
      </Show>
      <Show
        when={subscriptions.feeds().length}
        fallback={<EmptyState icon="podcast">{t("Aucun podcast enregistré.")}</EmptyState>}
      >
        <div class="podcast-library">
          <nav aria-label={t("Abonnements podcasts")}>
            <For each={subscriptions.feeds()}>
              {(row) => (
                <button
                  aria-pressed={row.url === selected()}
                  onClick={() => {
                    unsubscribe.cancel();
                    setSelected(row.url);
                  }}
                >
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
                    disabled={!!busy() || !isNative() || !subscriptions.writable()}
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
                    disabled={!!busy() || !subscriptions.writable()}
                    aria-label={t("Se désabonner")}
                    title={t("Se désabonner")}
                    onClick={() => {
                      unsubscribe.ask(current());
                    }}
                  >
                    <Icon name="close" />
                  </button>
                </div>
                <Show when={unsubscribe.pending()}>
                  {(pending) => (
                    <div
                      class="podcast-confirmation"
                      role="group"
                      aria-label={t("Confirmer le désabonnement")}
                    >
                      <span>{t("Se désabonner de « {0} » ?", pending().title)}</span>
                      <button
                        disabled={!!busy() || !subscriptions.writable()}
                        onClick={() => {
                          void unsubscribe.confirm();
                        }}
                      >
                        {t("Confirmer")}
                      </button>
                      <button
                        disabled={!!busy() || !subscriptions.writable()}
                        onClick={unsubscribe.cancel}
                      >
                        {t("Annuler")}
                      </button>
                    </div>
                  )}
                </Show>
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
                          <Show when={library.podcastListened.has(current().url, row.id)}>
                            <small class="podcast-listened">
                              <Icon name="check" /> {t("Écouté")}
                            </small>
                          </Show>
                          <Show when={row.summary}>
                            <p>{row.summary}</p>
                          </Show>
                        </div>
                        <DownloadButton
                          label={t("Télécharger {0}", row.title)}
                          identity={owner()}
                          disabled={
                            !isNative() ||
                            !library.parental.available() ||
                            !!library.parental.status()?.policy.enabled ||
                            (!!downloads.busy() && downloads.busy() !== row.url)
                          }
                          busy={downloads.busy() === row.url}
                          onClick={() => downloads.save(row.url, row.title)}
                        />
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

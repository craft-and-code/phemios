import { StickyHeader } from "../components/StickyHeader";
import { PodcastSubscribeForm } from "../components/PodcastSubscribeForm";
import { DownloadButton } from "../components/DownloadButton";
import { AccountNotice } from "../components/AccountNotice";
import { PageLoader } from "../components/PageLoader";
import { Feedback } from "../components/Feedback";
import { createSignal, createMemo, createEffect, on, For, Show } from "solid-js";
import { t } from "../i18n";
import { useLibrary } from "../library/context";
import { createEpisodeDownloads } from "../podcasts/downloads";
import {
  readPodcastFeed,
  resolvePodcastFeed,
  downloadPodcastEpisode,
  isNative,
} from "../platform/desktop";
import { RefreshButton } from "../components/RefreshButton";
import { PodcastEpisodeList } from "../components/PodcastEpisodeList";
import { Icon } from "../components/Icon";
import { createPodcastReader } from "../podcasts/reader";
import { EmptyState } from "../components/EmptyState";
/** RSS subscriptions stay usable offline; adding/updating is explicit and never starts an episode. */
export function PodcastsPage(props: { query: string }) {
  const library = useLibrary(),
    subscriptions = library.podcastSubscriptions,
    [url, setUrl] = createSignal(""),
    [selected, setSelected] = createSignal(subscriptions.feeds()[0]?.url ?? "");
  const owner = createMemo(() => ({ session: library.session(), source: library.source() }));
  const {
    busy,
    error,
    load,
    cancel: cancelLoad,
  } = createPodcastReader({
    owner,
    selected,
    writable: subscriptions.writable,
    capture: subscriptions.capture,
    resolve: resolvePodcastFeed,
    read: readPodcastFeed,
    allowed: (value) => library.parental.podcastAllowed(value),
    saved: (data) => {
      setSelected(data.url);
      setUrl("");
    },
  });
  const refreshIdentity = createMemo(() => ({ owner: owner(), selected: selected() }));
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
      unsubscribe.cancel();
    }),
  );
  createEffect(() => {
    const rows = subscriptions.feeds();
    if (!rows.some((row) => row.url === selected())) setSelected(rows[0]?.url ?? "");
  });
  const feed = () => subscriptions.feeds().find((f) => f.url === selected());
  const episodes = () =>
    (feed()?.episodes ?? []).filter((e) =>
      `${e.title} ${e.summary}`.toLocaleLowerCase().includes(props.query.toLocaleLowerCase()),
    );
  const episodeScope = createMemo(() => ({ owner: owner(), feed: selected(), query: props.query }));
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
          <nav class="podcast-subscriptions" aria-label={t("Abonnements podcasts")}>
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
                  <RefreshButton
                    identity={refreshIdentity()}
                    label={t("Actualiser les épisodes")}
                    busy={busy() === "refresh"}
                    disabled={
                      (!!busy() && busy() !== "refresh") || !isNative() || !subscriptions.writable()
                    }
                    onCancel={cancelLoad}
                    onRefresh={() => load(current().url, "refresh")}
                  />
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
                <PodcastEpisodeList
                  episodes={episodes()}
                  scope={episodeScope()}
                  listened={(row) => library.podcastListened.has(current().url, row.id)}
                  actions={(row) => (
                    <>
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
                        class="icon-button quiet"
                        aria-label={t("Lire {0}", row.title)}
                        title={t("Lire {0}", row.title)}
                        onClick={() => void library.podcast.start(current(), row)}
                      >
                        <Icon name="play" />
                      </button>
                    </>
                  )}
                />
              </section>
            )}
          </Show>
        </div>
      </Show>
    </section>
  );
}

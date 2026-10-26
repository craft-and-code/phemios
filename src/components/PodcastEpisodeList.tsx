import { For, Show, type JSX } from "solid-js";
import { t, locale } from "../i18n";
import { Icon } from "./Icon";
import { EmptyState } from "./EmptyState";
import { Pagination } from "./Pagination";
import { createEpisodePaging, episodePageSize } from "../podcasts/paging";
import type { Episode } from "../podcasts/feed";
/** Bounded episode presentation; callers retain account, download and playback admission. */
export function PodcastEpisodeList(props: {
  episodes: readonly Episode[];
  scope: unknown;
  listened?: (episode: Episode) => boolean;
  actions: (episode: Episode) => JSX.Element;
}) {
  const page = createEpisodePaging(
    () => props.episodes,
    () => props.scope,
  );
  return (
    <div class="podcast-episode-results">
      <ul>
        <For each={page.rows()}>
          {(row) => (
            <li>
              <div class="podcast-episode-text">
                <strong>{row.title}</strong>
                <small>
                  {row.date ? new Date(row.date).toLocaleDateString(locale()) : ""}
                  {row.duration
                    ? ` · ${Math.floor(row.duration / 60)}:${String(Math.floor(row.duration % 60)).padStart(2, "0")}`
                    : ""}
                </small>
                <Show when={props.listened?.(row)}>
                  <small class="podcast-listened">
                    <Icon name="check" /> {t("Écouté")}
                  </small>
                </Show>
                <Show when={row.summary}>
                  <p>{row.summary}</p>
                </Show>
              </div>
              <div class="podcast-episode-actions">{props.actions(row)}</div>
            </li>
          )}
        </For>
      </ul>
      <Show when={page.total() > episodePageSize}>
        <Pagination
          offset={page.offset()}
          size={episodePageSize}
          total={page.total()}
          count={page.rows().length}
          onOffset={page.select}
        />
      </Show>
      <Show when={!page.total()}>
        <EmptyState icon="podcast">{t("Aucun épisode dans cette sélection.")}</EmptyState>
      </Show>
    </div>
  );
}

import { Show, type JSX } from "solid-js";
import { t } from "../i18n";
import { EmptyState } from "./EmptyState";
import { Icon } from "./Icon";
import { StickyHeader } from "./StickyHeader";
/** Drawer and dedicated workspace share controls and occurrence rows, never queue ownership. */
export function PlaybackQueueView(props: {
  standalone?: boolean | undefined;
  count: number;
  actions: JSX.Element;
  search?: JSX.Element;
  notices?: JSX.Element;
  children: JSX.Element;
  navigation?: JSX.Element;
  onClose?: (() => void) | undefined;
}) {
  const heading = () => (
    <div class="page-heading">
      <Show
        when={!props.standalone}
        fallback={<span class="result-count">{t("{0} pistes", props.count)}</span>}
      >
        <h2>{t("Liste de lecture")}</h2>
      </Show>
      {props.navigation}
      <Show when={props.onClose}>
        <button
          class="icon-button quiet icon-close"
          aria-label={t("Fermer")}
          onClick={() => props.onClose?.()}
        >
          <Icon name="close" />
        </button>
      </Show>
    </div>
  );
  return (
    <aside
      class="playback-queue"
      classList={{ "standalone-queue": props.standalone }}
      aria-label={t("Liste de lecture")}
    >
      <Show
        when={props.standalone}
        fallback={
          <>
            {heading()}
            <small class="muted queue-count">{t("{0} pistes", props.count)}</small>
            <div class="queue-actions">{props.actions}</div>
          </>
        }
      >
        <StickyHeader class="queue-workspace-header">
          {heading()}
          <div class="queue-actions">{props.actions}</div>
        </StickyHeader>
      </Show>
      {props.search}
      {props.notices}
      <Show
        when={props.count}
        fallback={<EmptyState icon="playlist">{t("La liste de lecture est vide.")}</EmptyState>}
      >
        {props.children}
      </Show>
    </aside>
  );
}

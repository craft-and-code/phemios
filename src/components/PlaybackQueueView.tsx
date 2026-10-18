import { Show, type JSX } from "solid-js";
import { t } from "../i18n";
import { EmptyState } from "./EmptyState";
import { Icon } from "./Icon";
import { StickyHeader } from "./StickyHeader";
/** Drawer and dedicated workspace share controls and occurrence rows, never queue ownership. */
export function PlaybackQueueView(props: {
  standalone?: boolean | undefined;
  /** Only the dedicated workspace header follows connection visibility; drawer controls stay available. */
  headerVisible?: boolean | undefined;
  count: number;
  duration?: string;
  actions: JSX.Element;
  search?: JSX.Element;
  notices?: JSX.Element;
  children: JSX.Element;
  navigation?: JSX.Element;
  onClose?: (() => void) | undefined;
}) {
  const summary = () =>
    `${t("{0} pistes", props.count)}${props.duration ? ` · ${props.duration}` : ""}`;
  const heading = () => (
    <div class="page-heading">
      <Show when={!props.standalone} fallback={<span class="result-count">{summary()}</span>}>
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
            <small class="muted queue-count">{summary()}</small>
            <div class="queue-actions">{props.actions}</div>
          </>
        }
      >
        <StickyHeader class="queue-workspace-header" visible={props.headerVisible}>
          {heading()}
          <div class="queue-actions">{props.actions}</div>
        </StickyHeader>
      </Show>
      <Show when={!props.standalone || props.headerVisible !== false}>{props.search}</Show>
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

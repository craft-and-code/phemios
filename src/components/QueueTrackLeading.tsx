import { Show } from "solid-js";
import { t } from "../i18n";
import { ActivityGlyph } from "./ActivityGlyph";
import { Icon } from "./Icon";
/** Align the number with the title and optional lyric acquisition underneath it. */
export function QueueTrackLeading(props: {
  number: number;
  albumTotal: number;
  available: boolean;
  busy: boolean;
  disabled: boolean;
  onAction: () => void;
}) {
  const label = () =>
    props.busy ? t("Arrêter le téléchargement des paroles") : t("Télécharger les paroles");
  return (
    <div class="queue-track-leading">
      <small class="queue-track-number">
        {props.number}/{props.albumTotal}
      </small>
      <Show
        when={props.available}
        fallback={
          <button
            class="icon-button quiet queue-lyrics-track"
            title={label()}
            aria-label={label()}
            disabled={props.disabled}
            onClick={props.onAction}
          >
            <Show when={props.busy} fallback={<Icon name="lyrics-download" />}>
              <ActivityGlyph cancellable />
            </Show>
          </button>
        }
      >
        <span
          class="queue-lyrics-track queue-lyrics-retained"
          title={t("Paroles disponibles")}
          role="img"
          aria-label={t("Paroles disponibles")}
        >
          <Icon name="lyrics" />
        </span>
      </Show>
    </div>
  );
}

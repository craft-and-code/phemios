import { children, Show, onCleanup, type JSX } from "solid-js";
import { t } from "../i18n";
import type { PlayableSelection } from "../library/playback-selection";
import type { QueueDrag } from "./queue-drag";
import { Icon } from "./Icon";
import { QueueRemoveButton } from "./QueueRemoveButton";
import { QueueTrackLeading } from "./QueueTrackLeading";
/** Queue occurrence presentation keeps remove, lyric acquisition and transport independent. */
export function QueueTrackRow(props: {
  row: PlayableSelection & { index: number };
  /** Resident decorative artwork is supplied by the standalone editor only. */
  cover?: JSX.Element;
  status?: "playing" | "paused" | "connecting" | undefined;
  reorderable: boolean;
  playable: boolean;
  drag: QueueDrag;
  onGrip: (button: HTMLButtonElement) => () => void;
  onPlay: () => void;
  removeDisabled: boolean;
  removeReason?: string | undefined;
  onRemove: () => void;
  words: { available: boolean; busy: boolean; disabled: boolean; onAction: () => void };
}) {
  // JSX-valued props are getters; resolve once so layout probes do not mount hidden artwork copies.
  const cover = children(() => props.cover);
  return (
    <li
      data-queue-index={props.row.index}
      classList={{
        current: !!props.status,
        "queue-row-with-cover": !!cover(),
        "queue-drop-target": !!props.drag.edge(props.row.index),
        "queue-drop-before": props.drag.edge(props.row.index) === "before",
        "queue-drop-after": props.drag.edge(props.row.index) === "after",
        "queue-drag-source": props.drag.dragged() === props.row.index,
      }}
      draggable={props.reorderable}
      onClick={(event) => {
        if (
          event.target instanceof Element &&
          !event.target.closest("button, .queue-track-leading, .queue-lyrics-track") &&
          props.playable
        )
          props.onPlay();
      }}
      onDragStart={(event) => props.drag.nativeStart(event, props.row.index)}
      onDragOver={(event) => props.drag.nativeOver(event, props.row.index)}
      onDragEnd={props.drag.cancel}
      onDrop={(event) => props.drag.nativeDrop(event, props.row.index)}
    >
      <button
        class="queue-grip icon-button quiet"
        draggable={false}
        ref={(button) => onCleanup(props.onGrip(button))}
        disabled={!props.reorderable}
        aria-label={t("Déplacer {0}", props.row.title)}
        title={t("Glisser pour déplacer · flèches haut/bas au clavier")}
        onPointerDown={(event) => props.drag.pointerDown(event, props.row.index)}
        onPointerMove={props.drag.pointerMove}
        onPointerUp={props.drag.pointerUp}
        onPointerCancel={props.drag.cancel}
        onLostPointerCapture={props.drag.cancel}
        onKeyDown={(event) => props.drag.key(event, props.row.index)}
      >
        <Icon name="grip" />
      </button>
      <QueueTrackLeading
        number={props.row.number}
        albumTotal={props.row.albumTotal}
        {...props.words}
      />
      <QueueRemoveButton
        title={props.row.title}
        disabled={props.removeDisabled}
        reason={props.removeReason}
        onRemove={props.onRemove}
      />
      <Show when={cover()}>
        <span class="queue-track-cover" aria-hidden="true">
          {cover()}
        </span>
      </Show>
      <button class="queue-track" disabled={!props.playable} onClick={props.onPlay}>
        <span class="queue-track-description">
          <strong>{props.row.title}</strong>
          <small>
            {props.row.artist} · {props.row.album?.title}
          </small>
        </span>
        <span class="queue-track-state">
          <Show when={props.status}>
            <Icon name={props.status === "playing" ? "volume" : "pause"} />
          </Show>
        </span>
      </button>
    </li>
  );
}

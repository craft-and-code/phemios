import { createSignal, For, Show } from "solid-js";
import { t } from "../i18n";
import { useLibrary } from "../library/context";
import { moveQueueOccurrence } from "../library/queue-order";
import { Feedback } from "./Feedback";
import { Icon } from "./Icon";
/** Occurrence edits share the native queue generation and leave the current audio untouched. */
export function PlaybackQueue(props: { onClose: () => void }) {
  const player = useLibrary().player,
    [visible, setVisible] = createSignal(100),
    [dragged, setDragged] = createSignal<{ index: number; id: number }>(),
    [dropTarget, setDropTarget] = createSignal<number>();
  const reorderable = () => !player.busy() && player.state().device !== "@hqplayer";
  const order = () => player.queue().map((row) => row.index);
  function reorder(next: number[], id = player.state().queue_id) {
    if (reorderable()) void player.action("queue", { queue_id: id, order: next });
  }
  return (
    <aside class="playback-queue">
      <div class="page-heading">
        <h2>{t("Liste de lecture")}</h2>
        <button
          class="icon-button quiet"
          disabled={!reorderable() || player.queue().length < 2}
          aria-label={t("Inverser la liste de lecture")}
          title={t("Inverser la liste de lecture")}
          onClick={() => reorder(order().reverse())}
        >
          <Icon name="reverse" />
        </button>
        <button
          class="icon-button quiet icon-close"
          aria-label={t("Fermer")}
          onClick={props.onClose}
        >
          <Icon name="close" />
        </button>
      </div>
      <Show when={player.error()}>
        <Feedback error message={player.error()} />
      </Show>
      <ol>
        <For each={player.queue().slice(0, visible())}>
          {(row) => (
            <li
              classList={{
                current: row.index === player.state().index,
                "queue-drop-target": dropTarget() === row.index,
              }}
              draggable={reorderable()}
              onDragStart={(event) => {
                if (!reorderable()) {
                  event.preventDefault();
                  return;
                }
                setDragged({ index: row.index, id: player.state().queue_id });
                if (event.dataTransfer) {
                  event.dataTransfer.effectAllowed = "move";
                  event.dataTransfer.setData("text/plain", String(row.index));
                }
              }}
              onDragOver={(event) => {
                if (dragged() && reorderable()) {
                  event.preventDefault();
                  setDropTarget(row.index);
                }
              }}
              onDragEnd={() => {
                setDragged(undefined);
                setDropTarget(undefined);
              }}
              onDrop={(event) => {
                event.preventDefault();
                const source = dragged();
                setDragged(undefined);
                setDropTarget(undefined);
                if (source && source.id === player.state().queue_id && reorderable())
                  reorder(moveQueueOccurrence(order(), source.index, row.index), source.id);
              }}
            >
              <div class="queue-move-controls">
                <button
                  class="icon-button quiet"
                  disabled={!reorderable() || order()[0] === row.index}
                  aria-label={t("Monter {0}", row.title)}
                  onClick={() => {
                    const next = order(),
                      neighbour = next[next.indexOf(row.index) - 1];
                    if (neighbour !== undefined)
                      reorder(moveQueueOccurrence(next, row.index, neighbour));
                  }}
                >
                  <Icon name="chevron-up" />
                </button>
                <button
                  class="icon-button quiet"
                  disabled={!reorderable() || order().at(-1) === row.index}
                  aria-label={t("Descendre {0}", row.title)}
                  onClick={() => {
                    const next = order(),
                      neighbour = next[next.indexOf(row.index) + 1];
                    if (neighbour !== undefined)
                      reorder(moveQueueOccurrence(next, row.index, neighbour));
                  }}
                >
                  <Icon name="chevron-down" />
                </button>
              </div>
              <button
                class="queue-track"
                disabled={player.busy()}
                onClick={() => void player.action("jump", row.index)}
              >
                <small class="queue-track-number">
                  {row.number}/{row.albumTotal}
                </small>
                <span>
                  <strong>{row.title}</strong>
                  <small>
                    {row.artist} · {row.album?.title}
                  </small>
                </span>
                <span class="queue-track-state">
                  <Show when={row.index === player.state().index}>
                    <Icon name={player.state().status === "playing" ? "volume" : "pause"} />
                  </Show>
                </span>
              </button>
            </li>
          )}
        </For>
      </ol>
      <Show when={player.queue().length > visible()}>
        <button onClick={() => setVisible(visible() + 100)}>{t("Afficher davantage")}</button>
      </Show>
    </aside>
  );
}

import { QueueLyrics } from "./QueueLyrics";
import { QueueSave } from "./QueueSave";
import { locale } from "../i18n";
import { createSignal, For, Show } from "solid-js";
import { t } from "../i18n";
import { useLibrary } from "../library/context";
import { moveQueueOccurrence } from "../library/queue-order";
import { Feedback } from "./Feedback";
import { Icon } from "./Icon";
/** Occurrence edits share the native queue generation and leave the current audio untouched. */
export function PlaybackQueue(props: { onClose: () => void }) {
  const player = useLibrary().player,
    [feedbackHost, setFeedbackHost] = createSignal<HTMLElement>(),
    [visible, setVisible] = createSignal(100),
    [dragged, setDragged] = createSignal<{ index: number; id: number }>(),
    [dropTarget, setDropTarget] = createSignal<number>();
  const grips = new Map<number, HTMLButtonElement>();
  let pointerDrag:
    | { pointerId: number; x: number; y: number; index: number; id: number; moved: boolean }
    | undefined;
  function clearPointerDrag() {
    pointerDrag = undefined;
    setDragged(undefined);
    setDropTarget(undefined);
  }
  const reorderable = () => !player.busy() && player.state().device !== "@hqplayer";
  const order = () => player.queue().map((row) => row.index);
  function reorder(next: number[], id = player.state().queue_id, focusIndex?: number) {
    if (reorderable())
      void player.action("queue", { queue_id: id, order: next }).then(() => {
        if (
          focusIndex !== undefined &&
          id === player.state().queue_id &&
          document.activeElement === document.body
        )
          grips.get(focusIndex)?.focus();
      });
  }
  return (
    <aside class="playback-queue">
      <div class="page-heading">
        <h2>{t("Liste de lecture")}</h2>
        <button
          class="icon-button quiet icon-close"
          aria-label={t("Fermer")}
          onClick={props.onClose}
        >
          <Icon name="close" />
        </button>
      </div>
      <div class="queue-actions">
        <button
          class="icon-button quiet"
          disabled={!reorderable() || player.queue().length < 2}
          aria-label={t("Trier la liste de lecture par titre")}
          title={t("Trier la liste de lecture par titre")}
          onClick={() =>
            reorder(
              [...player.queue()]
                .sort((a, b) => a.title.localeCompare(b.title, locale()) || a.index - b.index)
                .map((row) => row.index),
            )
          }
        >
          <Icon name="alphabet" />
        </button>
        <button
          class="icon-button quiet"
          disabled={!reorderable() || player.queue().length < 2}
          aria-label={t("Inverser la liste de lecture")}
          title={t("Inverser la liste de lecture")}
          onClick={() => reorder(order().reverse())}
        >
          <Icon name="reverse" />
        </button>
        <QueueLyrics feedbackHost={feedbackHost} />
        <QueueSave />
      </div>
      <div class="queue-notices" ref={setFeedbackHost} />
      <Show when={player.error()}>
        <Feedback error message={player.error()} />
      </Show>
      <ol>
        <For each={player.queue().slice(0, visible())}>
          {(row) => (
            <li
              data-queue-index={row.index}
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
              <button
                class="queue-grip icon-button quiet"
                draggable={false}
                ref={(button) => grips.set(row.index, button)}
                disabled={!reorderable()}
                aria-label={t("Déplacer {0}", row.title)}
                title={t("Glisser pour déplacer · flèches haut/bas au clavier")}
                onPointerDown={(event) => {
                  if (event.button !== 0 || !reorderable()) return;
                  event.preventDefault();
                  pointerDrag = {
                    pointerId: event.pointerId,
                    x: event.clientX,
                    y: event.clientY,
                    index: row.index,
                    id: player.state().queue_id,
                    moved: false,
                  };
                  event.currentTarget.setPointerCapture(event.pointerId);
                }}
                onPointerMove={(event) => {
                  const source = pointerDrag;
                  if (!source || source.pointerId !== event.pointerId || !reorderable()) return;
                  if (
                    Math.hypot(event.clientX - source.x, event.clientY - source.y) < 5 &&
                    !source.moved
                  )
                    return;
                  source.moved = true;
                  setDragged({ index: source.index, id: source.id });
                  const target = document
                    .elementFromPoint(event.clientX, event.clientY)
                    ?.closest<HTMLElement>("li[data-queue-index]");
                  const index =
                    target && event.currentTarget.closest("aside")?.contains(target)
                      ? Number(target.dataset.queueIndex)
                      : undefined;
                  setDropTarget(index !== undefined && order().includes(index) ? index : undefined);
                }}
                onPointerUp={(event) => {
                  const source = pointerDrag,
                    target = dropTarget();
                  if (!source || source.pointerId !== event.pointerId) return;
                  if (event.currentTarget.hasPointerCapture(event.pointerId))
                    event.currentTarget.releasePointerCapture(event.pointerId);
                  clearPointerDrag();
                  if (
                    source.moved &&
                    target !== undefined &&
                    source.id === player.state().queue_id &&
                    reorderable()
                  )
                    reorder(moveQueueOccurrence(order(), source.index, target), source.id);
                }}
                onPointerCancel={clearPointerDrag}
                onKeyDown={(event) => {
                  if (!["ArrowUp", "ArrowDown"].includes(event.key)) return;
                  event.preventDefault();
                  const next = order(),
                    neighbour = next[next.indexOf(row.index) + (event.key === "ArrowUp" ? -1 : 1)];
                  if (neighbour !== undefined)
                    reorder(
                      moveQueueOccurrence(next, row.index, neighbour),
                      player.state().queue_id,
                      row.index,
                    );
                }}
              >
                <Icon name="grip" />
              </button>
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

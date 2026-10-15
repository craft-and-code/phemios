import { PlaybackQueueView } from "./PlaybackQueueView";
import { QueueTrackRow } from "./QueueTrackRow";
import { createQueueDrag } from "./queue-drag";
import { QueueClearButton } from "./QueueClearButton";
import { QueueLyrics } from "./QueueLyrics";
import { QueueAdd } from "./QueueAdd";
import { QueueCollection } from "./QueueCollection";
import { locale } from "../i18n";
import { createSignal, For, Show, onCleanup, type JSX } from "solid-js";
import { t } from "../i18n";
import { useLibrary } from "../library/context";
import { originalQueueOrder } from "../library/queue-order";
import { Feedback } from "./Feedback";
import { Icon } from "./Icon";
/** Occurrence edits share the native queue generation and leave the current audio untouched. */
export function PlaybackQueue(props: {
  onClose?: (() => void) | undefined;
  standalone?: boolean;
  navigation?: JSX.Element;
}) {
  const library = useLibrary(),
    player = library.player,
    lyrics = library.queueLyrics,
    [feedbackHost, setFeedbackHost] = createSignal<HTMLElement>(),
    [visible, setVisible] = createSignal(100),
    [adding, setAdding] = createSignal(false);
  const grips = new Map<number, HTMLButtonElement>();
  let disposed = false;
  onCleanup(() => {
    disposed = true;
    grips.clear();
  });
  const reorderable = () =>
    !player.busy() && player.state().device !== "@hqplayer" && player.queue().length > 1;
  const order = () => player.queue().map((row) => row.index);
  const drag = createQueueDrag({
    enabled: reorderable,
    order: () => order(),
    id: () => player.state().queue_id,
    onReorder: reorder,
  });
  const protectedOccurrence = (index: number) =>
    index !== player.state().index &&
    ["playing", "connecting"].includes(player.state().status) &&
    player.state().protected_occurrences?.includes(index) === true;
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
    <PlaybackQueueView
      standalone={props.standalone}
      count={player.queue().length}
      onClose={props.onClose}
      navigation={props.navigation}
      actions={
        <>
          <button
            class="icon-button quiet"
            aria-label={t("Ajouter à la liste de lecture")}
            title={t("Ajouter à la liste de lecture")}
            aria-expanded={adding()}
            aria-pressed={adding()}
            onClick={() => setAdding(!adding())}
          >
            <Icon name="plus" />
          </button>
          <button
            class="icon-button quiet"
            disabled={!reorderable() || player.queue().length < 2}
            aria-label={t("Rétablir l’ordre initial de la liste de lecture")}
            title={t("Rétablir l’ordre initial de la liste de lecture")}
            onClick={() => reorder(originalQueueOrder(order()))}
          >
            <Icon name="ordered" />
          </button>
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
          <QueueCollection />
          <QueueClearButton
            count={player.queue().length}
            busy={player.busy()}
            clearing={player.clearing()}
            onClear={() => {
              void player.clearQueue().then((cleared) => {
                if (cleared) {
                  drag.cancel();
                  grips.clear();
                  setVisible(100);
                }
              });
            }}
          />
        </>
      }
      search={
        <Show when={adding()}>
          <QueueAdd onClose={() => setAdding(false)} />
        </Show>
      }
      notices={
        <>
          <div class="queue-notices" ref={setFeedbackHost} />
          <Show when={player.error()}>
            <Feedback error message={player.error()} />
          </Show>
        </>
      }
    >
      <ol>
        <For each={player.queue().slice(0, visible())}>
          {(row) => (
            <QueueTrackRow
              row={row}
              cover={
                props.standalone ? (
                  <Show
                    when={row.album && library.image(row.album.reference, "cover")}
                    fallback={<Icon name="disc" />}
                  >
                    {(url) => <img src={url()} alt="" decoding="async" draggable={false} />}
                  </Show>
                ) : undefined
              }
              status={
                ["playing", "paused", "connecting"].includes(player.state().status) &&
                row.index === player.state().index
                  ? (player.state().status as "playing" | "paused" | "connecting")
                  : undefined
              }
              reorderable={reorderable()}
              playable={player.canStart(row.reference) && !player.busy()}
              drag={drag}
              onGrip={(button) => {
                grips.set(row.index, button);
                return () => {
                  if (grips.get(row.index) === button) grips.delete(row.index);
                };
              }}
              onPlay={() => void player.playQueueOccurrence(row.index)}
              words={{
                get available() {
                  return lyrics.available(row.reference) === true;
                },
                get busy() {
                  return lyrics.trackBusy(row.reference);
                },
                get disabled() {
                  return (
                    (lyrics.busy() && !lyrics.trackBusy(row.reference)) ||
                    !lyrics.eligible(row.reference)
                  );
                },
                onAction: () => {
                  if (lyrics.trackBusy(row.reference)) void lyrics.cancel();
                  else void lyrics.acquire(row.reference);
                },
              }}
              removeDisabled={
                player.busy() ||
                player.state().device === "@hqplayer" ||
                protectedOccurrence(row.index)
              }
              removeReason={
                player.state().device === "@hqplayer"
                  ? t("Le retrait de piste HQPlayer n’est pas pris en charge.")
                  : protectedOccurrence(row.index)
                    ? t("Ce titre participe au fondu en cours. Réessayez à la fin du fondu.")
                    : undefined
              }
              onRemove={() => {
                void player.removeOccurrence(row.index).then((removed) => {
                  if (removed && !disposed) drag.cancel();
                });
              }}
            />
          )}
        </For>
      </ol>
      <Show when={player.queue().length > visible()}>
        <button onClick={() => setVisible(visible() + 100)}>{t("Afficher davantage")}</button>
      </Show>
    </PlaybackQueueView>
  );
}

import { createMemo, createSignal, createEffect, on, For, Show } from "solid-js";
import { t } from "../i18n";
import type { Album } from "../library/types";
import { Artwork } from "./Artwork";
import { CoverPlay } from "./CoverPlay";
import { coverOpacity, draggedCover } from "../visualizer/cover-flow-policy";
import { EmptyState } from "./EmptyState";
/** A bounded nine-cover perspective window reuses cached artwork, independent of catalog size. */
export function CoverFlow(props: { albums: readonly Album[] }) {
  const [selected, setSelected] = createSignal("");
  const index = createMemo(() =>
    Math.max(
      0,
      props.albums.findIndex((album) => album.reference === selected()),
    ),
  );
  const album = () => props.albums[index()];
  const window = createMemo(() => props.albums.slice(Math.max(0, index() - 4), index() + 5));
  const positions = createMemo(
    () => new Map(props.albums.map((row, index) => [row.reference, index])),
  );
  createEffect(
    on(
      () => props.albums.map((row) => row.reference).join("\0"),
      () => setSelected(props.albums[0]?.reference ?? ""),
    ),
  );
  const [dragging, setDragging] = createSignal(false);
  let drag: { id: number; x: number; start: number } | undefined,
    dragged = false;
  const choose = (value: number) => {
    const next = props.albums[Math.max(0, Math.min(props.albums.length - 1, value))];
    if (next) setSelected(next.reference);
  };
  let movement = 0;
  return (
    <Show
      when={album()}
      fallback={<EmptyState icon="disc">{t("Aucun album dans cette sélection.")}</EmptyState>}
    >
      <div
        class="cover-flow"
        role="region"
        aria-label={t("Cover Flow")}
        tabindex="0"
        onKeyDown={(event) => {
          const next =
            event.key === "ArrowLeft"
              ? index() - 1
              : event.key === "ArrowRight"
                ? index() + 1
                : event.key === "Home"
                  ? 0
                  : event.key === "End"
                    ? props.albums.length - 1
                    : undefined;
          if (next !== undefined) {
            event.preventDefault();
            choose(next);
          }
        }}
        onWheel={(event) => {
          event.preventDefault();
          movement += Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
          if (Math.abs(movement) > 35) {
            choose(index() + Math.sign(movement));
            movement = 0;
          }
        }}
      >
        <div
          class="cover-flow-stage"
          classList={{ "flow-dragging": dragging() }}
          onPointerDown={(event) => {
            if (event.button !== 0 || (event.target as Element).closest("button")) return;
            event.currentTarget.closest<HTMLElement>(".cover-flow")?.focus();
            drag = { id: event.pointerId, x: event.clientX, start: index() };
            dragged = false;
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={(event) => {
            if (!drag || drag.id !== event.pointerId) return;
            const dx = event.clientX - drag.x;
            if (Math.abs(dx) > 6) {
              dragged = true;
              setDragging(true);
              choose(draggedCover(drag.start, dx, props.albums.length));
            }
          }}
          onPointerUp={(event) => {
            if (drag?.id === event.pointerId) {
              drag = undefined;
              setDragging(false);
            }
          }}
          onPointerCancel={() => {
            drag = undefined;
            setDragging(false);
            dragged = false;
          }}
          onClick={(event) => {
            if (dragged) {
              event.preventDefault();
              event.stopPropagation();
              dragged = false;
            }
          }}
          onDragStart={(event) => event.preventDefault()}
        >
          <For each={window()}>
            {(row) => {
              const at = () => positions().get(row.reference) ?? 0;
              const distance = () => at() - index();
              return (
                <article
                  class="cover-flow-card"
                  classList={{ central: distance() === 0 }}
                  style={{
                    "--offset": distance(),
                    "--depth": Math.abs(distance()),
                    "z-index": 10 - Math.abs(distance()),
                    opacity: coverOpacity(distance()),
                  }}
                >
                  <a
                    href={`#/album/${encodeURIComponent(row.reference)}`}
                    tabindex={distance() === 0 ? 0 : -1}
                    aria-label={row.title}
                    onClick={(event) => {
                      if (dragged) {
                        event.preventDefault();
                        return;
                      }
                      if (distance()) {
                        event.preventDefault();
                        choose(at());
                      }
                    }}
                  >
                    <Artwork album={row} />
                  </a>
                  <Show when={distance() === 0}>
                    <CoverPlay reference={row.reference} title={row.title} />
                  </Show>
                </article>
              );
            }}
          </For>
        </div>
        <div class="cover-flow-controls">
          <div class="cover-flow-caption" aria-live="polite">
            <a href={`#/album/${encodeURIComponent(album()!.reference)}`}>{album()!.title}</a>
            <small>
              {album()!.year ?? t("Année inconnue")} · {index() + 1}/{props.albums.length}
            </small>
          </div>
        </div>
        <input
          type="range"
          min="0"
          max={Math.max(0, props.albums.length - 1)}
          step="1"
          value={index()}
          aria-label={t("Parcourir les pochettes")}
          onInput={(event) => choose(Number(event.currentTarget.value))}
        />
      </div>
    </Show>
  );
}

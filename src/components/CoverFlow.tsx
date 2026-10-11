import { createCoverMotion, coverWindow } from "../visualizer/cover-motion";
import { coverLetterStops, type CoverPosition } from "../visualizer/cover-position";
import { createCoverScrub } from "../visualizer/cover-scrub";
import { createCoverCatalog } from "../visualizer/cover-catalog";
import { createMemo, createSignal, createEffect, on, onCleanup, For, Show } from "solid-js";
import { t } from "../i18n";
import type { Album } from "../library/types";
import { Artwork } from "./Artwork";
import { CoverPlay } from "./CoverPlay";
import { coverOpacity, coverDragTarget } from "../visualizer/cover-flow-policy";
import { EmptyState } from "./EmptyState";
/** A bounded perspective window follows an interruptible fractional viewport, independent of catalog size. */
export function CoverFlow(props: {
  albums: readonly Album[];
  position: CoverPosition;
  reverse: boolean;
}) {
  const [selected, setSelected] = createSignal(""),
    [visualIndex, setVisualIndex] = createSignal(0);
  const motion = createCoverMotion(setVisualIndex);
  const catalog = createCoverCatalog(
    () => props.albums,
    () => props.reverse,
    selected,
  );
  const { index, positions } = catalog;
  const album = () => props.albums[index()];
  const window = createMemo(() =>
    coverWindow(visualIndex(), props.albums.length).map((at) => props.albums[at]!),
  );
  createEffect(
    on(catalog.order, () => {
      scrub.cancel();
      setSelected(props.position.restore(props.albums, props.reverse));
      motion.reset(index());
    }),
  );
  const [dragging, setDragging] = createSignal(false);
  let drag: { id: number; x: number; start: number } | undefined,
    dragged = false;
  const choose = (value: number) => {
    const target = Math.max(0, Math.min(props.albums.length - 1, value));
    const next = props.albums[target];
    if (next) {
      if (target === index()) return;
      setSelected(next.reference);
      if (matchMedia("(prefers-reduced-motion: reduce)").matches) motion.reset(target);
      else motion.move(target);
      props.position.select(next.reference);
    }
  };
  const scrub = createCoverScrub(choose);
  const finishScrub = () => {
    scrub.finish();
  };
  onCleanup(() => {
    scrub.dispose();
    motion.dispose();
  });
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
          }}
          onPointerMove={(event) => {
            if (!drag || drag.id !== event.pointerId) return;
            const dx = event.clientX - drag.x;
            const target = coverDragTarget(drag.start, dx, props.albums.length);
            if (target !== undefined) {
              event.currentTarget.setPointerCapture(event.pointerId);
              dragged = true;
              setDragging(true);
              choose(target);
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
              const distance = () => at() - visualIndex();
              return (
                <article
                  class="cover-flow-card"
                  classList={{ central: at() === index() }}
                  style={{
                    "--offset": distance(),
                    "--depth": Math.abs(distance()),
                    "z-index": 10 - Math.round(Math.abs(distance())),
                    opacity: coverOpacity(distance()),
                  }}
                >
                  <a
                    href={`#/album/${encodeURIComponent(row.reference)}`}
                    tabindex={at() === index() ? 0 : -1}
                    aria-label={row.title}
                    onClick={(event) => {
                      if (dragged) {
                        event.preventDefault();
                        return;
                      }
                      if (at() !== index()) {
                        event.preventDefault();
                        choose(at());
                      }
                    }}
                  >
                    <Artwork album={row} />
                  </a>
                  <Show when={at() === index()}>
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
        <div class="cover-flow-alphabet" role="group" aria-label={t("Parcourir les pochettes")}>
          <For each={coverLetterStops(props.albums)}>
            {(stop) => (
              <button
                type="button"
                classList={{ current: stop.letter === coverLetterStops([album()!])[0]?.letter }}
                aria-label={`${stop.letter} · ${props.albums[stop.index]?.title ?? ""}`}
                aria-pressed={stop.letter === coverLetterStops([album()!])[0]?.letter}
                onClick={() => {
                  scrub.cancel();
                  choose(stop.index);
                }}
                style={{
                  left: `${props.albums.length > 1 ? (stop.index / (props.albums.length - 1)) * 100 : 50}%`,
                }}
              >
                {stop.letter}
              </button>
            )}
          </For>
        </div>
        <input
          type="range"
          min="0"
          max={Math.max(0, props.albums.length - 1)}
          step="1"
          value={index()}
          aria-label={t("Parcourir les pochettes")}
          onPointerUp={finishScrub}
          onPointerCancel={finishScrub}
          onLostPointerCapture={finishScrub}
          onChange={finishScrub}
          onInput={(event) => scrub.move(Number(event.currentTarget.value))}
        />
      </div>
    </Show>
  );
}

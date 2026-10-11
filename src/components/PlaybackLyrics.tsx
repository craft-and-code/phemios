import { createLyricPhrase } from "../visualizer/lyric-motion";
import { lyricFit } from "../visualizer/lyric-fit";
import { createEffect, createSignal, onMount, onCleanup, Show } from "solid-js";
import { t } from "../i18n";
/** Pointer capture keeps the translucent lyric block visible throughout its move. */
export function PlaybackLyrics(props: { text: string; cue?: string | number; floating?: boolean }) {
  const [position, setPosition] = createSignal({ x: 50, y: 50 }),
    [dragging, setDragging] = createSignal(false),
    [scale, setScale] = createSignal(1);
  const phrase = createLyricPhrase(
    () => props.text,
    () => props.cue ?? props.text,
    () => !!props.floating,
  );
  let offset = { x: 0, y: 0 },
    element: HTMLParagraphElement | undefined,
    frame: number | undefined,
    disposed = false;
  function measure() {
    frame = undefined;
    const span = element?.firstElementChild as HTMLElement | null,
      stage = element?.parentElement;
    if (!span || !stage || disposed) return;
    setScale(
      lyricFit({
        width: span.offsetWidth,
        height: span.offsetHeight,
        angle: phrase()?.angle ?? 0,
        stageWidth: stage.clientWidth,
        stageHeight: stage.clientHeight,
        ...position(),
      }),
    );
  }
  function schedule() {
    if (disposed) return;
    if (frame !== undefined) cancelAnimationFrame(frame);
    frame = requestAnimationFrame(measure);
  }
  createEffect(() => {
    void phrase();
    void position();
    schedule();
  });
  onMount(() => {
    const observer = new ResizeObserver(schedule);
    if (element) observer.observe(element);
    if (element?.parentElement) observer.observe(element.parentElement);
    void document.fonts.ready.then(schedule);
    onCleanup(() => observer.disconnect());
  });
  onCleanup(() => {
    disposed = true;
    if (frame !== undefined) cancelAnimationFrame(frame);
  });
  function move(event: PointerEvent & { currentTarget: HTMLParagraphElement }) {
    const bounds = event.currentTarget.parentElement?.getBoundingClientRect();
    if (!bounds) return;
    setPosition({
      x: Math.max(
        20,
        Math.min(80, ((event.clientX - bounds.left - offset.x) / bounds.width) * 100),
      ),
      y: Math.max(
        12,
        Math.min(85, ((event.clientY - bounds.top - offset.y) / bounds.height) * 100),
      ),
    });
  }
  return (
    <p
      ref={(node) => {
        element = node;
      }}
      class="playback-current-lyrics"
      classList={{ "lyrics-dragging": dragging(), "floating-lyrics": !!props.floating }}
      style={{ left: `${position().x}%`, top: `${position().y}%` }}
      tabindex="0"
      aria-label={t("Déplacer les paroles")}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        offset = {
          x: event.clientX - bounds.left - bounds.width / 2,
          y: event.clientY - bounds.top - bounds.height / 2,
        };
        event.currentTarget.setPointerCapture(event.pointerId);
        setDragging(true);
      }}
      onPointerMove={(event) => {
        if (dragging()) move(event);
      }}
      onPointerUp={(event) => {
        event.currentTarget.releasePointerCapture(event.pointerId);
        setDragging(false);
      }}
      onPointerCancel={() => setDragging(false)}
      onKeyDown={(event) => {
        const moves: Record<string, [number, number]> = {
          ArrowLeft: [-2, 0],
          ArrowRight: [2, 0],
          ArrowUp: [0, -2],
          ArrowDown: [0, 2],
        };
        const delta = moves[event.key];
        if (!delta) return;
        event.preventDefault();
        setPosition((value) => ({
          x: Math.max(20, Math.min(80, value.x + delta[0])),
          y: Math.max(12, Math.min(85, value.y + delta[1])),
        }));
      }}
    >
      <Show when={phrase()} keyed>
        {(value) => (
          <span
            class="lyric-phrase"
            style={{ "--lyric-angle": `${value.angle}deg`, "--lyric-scale": scale() }}
          >
            {value.text}
          </span>
        )}
      </Show>
    </p>
  );
}

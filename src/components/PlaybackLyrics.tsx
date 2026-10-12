import { createLyricReadiness } from "../visualizer/lyric-readiness";
import type { LyricTypography, lyricTreatment } from "../visualizer/lyric-treatment";
import { createLyricPhrase } from "../visualizer/lyric-motion";
import { lyricFit } from "../visualizer/lyric-fit";
import { createEffect, createSignal, onMount, onCleanup, For, Show } from "solid-js";
import { t } from "../i18n";
/** Pointer capture keeps the translucent lyric block visible throughout its move. */
export function PlaybackLyrics(props: {
  text: string;
  cue?: string | number;
  floating?: boolean;
  hidden?: boolean;
  typography?: LyricTypography;
}) {
  const [position, setPosition] = createSignal({ x: 50, y: 50 }),
    [dragging, setDragging] = createSignal(false),
    [scale, setScale] = createSignal(1),
    [hidden, setHidden] = createSignal(document.hidden);
  const phrase = createLyricPhrase(
    () => props.text,
    () => props.cue ?? props.text,
    () => !!props.floating,
    () => props.typography ?? { track: "", phase: 0 },
  );
  const readiness = createLyricReadiness(phrase);
  let offset = { x: 0, y: 0 },
    element: HTMLParagraphElement | undefined,
    scheduled = false,
    disposed = false;
  function measure() {
    const span = element?.firstElementChild as HTMLElement | null,
      stage = element?.parentElement;
    if (!span || !stage || disposed || props.hidden) return;
    const fittedPhrase = phrase();
    setScale(
      lyricFit({
        width:
          Math.max(span.offsetWidth, span.scrollWidth) +
          (props.floating ? span.offsetHeight * 0.18 : 0),
        height:
          Math.max(span.offsetHeight, span.scrollHeight) +
          (props.floating ? span.offsetWidth * 0.18 : 0),
        angle: fittedPhrase?.angle ?? 0,
        stageWidth: stage.clientWidth,
        stageHeight: stage.clientHeight,
        ...position(),
      }),
    );
    readiness.measured(fittedPhrase);
  }
  function schedule() {
    if (disposed || scheduled) return;
    scheduled = true;
    // A background WebView may defer animation frames; actual cue/layout changes still need their fit.
    queueMicrotask(() => {
      scheduled = false;
      measure();
    });
  }
  createEffect(() => {
    void phrase();
    void position();
    void props.hidden;
    schedule();
  });
  onMount(() => {
    const visibility = () => setHidden(document.hidden);
    document.addEventListener("visibilitychange", visibility);
    onCleanup(() => document.removeEventListener("visibilitychange", visibility));
    const observer = new ResizeObserver(schedule);
    if (element) observer.observe(element);
    if (element?.parentElement) observer.observe(element.parentElement);
    void document.fonts.ready.then(schedule);
    onCleanup(() => observer.disconnect());
  });
  onCleanup(() => {
    disposed = true;
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
      hidden={props.hidden}
      classList={{
        "lyrics-dragging": dragging(),
        "floating-lyrics": !!props.floating,
        "lyrics-ready": readiness.ready(),
      }}
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
            <span
              class={`lyric-drift lyric-font-${value.treatment?.font ?? 0} lyric-composition-${value.treatment?.composition ?? 0}`}
              style={{
                "--phrase-size": `${value.treatment?.size ?? 1}em`,
                "--drift-duration": `${value.treatment?.duration ?? 12}s`,
                "--phrase-yaw": `${value.treatment?.yaw ?? 0}deg`,
                "animation-play-state": hidden() || dragging() ? "paused" : "running",
              }}
            >
              <Show when={value.treatment} fallback={value.text}>
                {(treatment) => (
                  <span class="lyric-foreground">
                    <LyricWords treatment={treatment()} />
                  </span>
                )}
              </Show>
            </span>
          </span>
        )}
      </Show>
    </p>
  );
}

/** Render the bounded readable groups once, retaining their measured typography and depth. */
function LyricWords(props: { treatment: ReturnType<typeof lyricTreatment> }) {
  return (
    <span class="lyric-words">
      <For each={props.treatment.chunks}>
        {(chunk, index) => (
          <>
            <Show when={index()}> </Show>
            <span
              class="lyric-chunk"
              classList={{ "lyric-emphasis": chunk.emphasis }}
              style={{
                "--chunk-size": `${chunk.size}em`,
                "--chunk-tilt": `${chunk.tilt}deg`,
                "--chunk-offset": `${chunk.offset}em`,
                "--chunk-depth": `${chunk.depth}px`,
                "--chunk-yaw": `${chunk.yaw}deg`,
              }}
            >
              {chunk.text}
            </span>
          </>
        )}
      </For>
    </span>
  );
}

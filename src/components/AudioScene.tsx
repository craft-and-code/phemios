import { createEffect, onCleanup, onMount } from "solid-js";
import { t } from "../i18n";
import { orbit, orbitDrag } from "../visualizer/orbit";
import { particles, type Scene } from "../visualizer/particles";
/** Perspective-projected 3D particles follow native consumed-sample RMS envelopes; pause holds the last pose. */
export function AudioScene(props: { scene: Scene; playing: boolean; levels: readonly number[] }) {
  let canvas: HTMLCanvasElement | undefined,
    frame = 0,
    clock = 0,
    last = 0,
    lastDraw = 0,
    bands: readonly number[] = [0, 0, 0, 0];
  let yaw = 0,
    pitch = 0,
    drag: { id: number; x: number; y: number; yaw: number; pitch: number } | undefined;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  function draw() {
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const width = canvas.clientWidth,
      height = canvas.clientHeight,
      ratio = Math.min(2, window.devicePixelRatio);
    if (!width || !height) return;
    if (
      canvas.width !== Math.round(width * ratio) ||
      canvas.height !== Math.round(height * ratio)
    ) {
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
    }
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, width, height);
    const color = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim(),
      scale = Math.min(width, height) * 0.32;
    const points = particles(props.scene, clock, reduced.matches ? [0, 0, 0, 0] : bands).map((p) =>
      orbit(p, yaw, pitch),
    );
    points.sort((a, b) => b.z - a.z);
    for (const point of points) {
      const perspective = 3.4 / (3.4 + point.z),
        x = width / 2 + point.x * scale * perspective,
        y = height / 2 + point.y * scale * perspective;
      ctx.globalAlpha = Math.max(0.12, Math.min(1, (1.9 - point.z) / 3 + 0.15 * point.energy));
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x, y, Math.max(0.6, (1.1 + point.energy) * perspective), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  function tick(timestamp: number) {
    if (!props.playing || document.hidden || reduced.matches) {
      frame = 0;
      last = 0;
      draw();
      return;
    }
    const elapsed = last ? Math.min(100, timestamp - last) / 1000 : 0;
    last = timestamp;
    clock += elapsed * (0.12 + bands.reduce((sum, value) => sum + value, 0) / 4);
    if (timestamp - lastDraw >= 33) {
      lastDraw = timestamp;
      draw();
    }
    frame = requestAnimationFrame(tick);
  }
  function schedule() {
    cancelAnimationFrame(frame);
    frame = 0;
    last = 0;
    if (props.playing && !document.hidden && !reduced.matches) frame = requestAnimationFrame(tick);
    else draw();
  }
  createEffect(() => {
    if (props.playing) bands = props.levels;
  });
  createEffect(() => {
    void props.playing;
    void props.scene;
    schedule();
  });
  onMount(() => {
    const observer = new ResizeObserver(draw);
    if (canvas) observer.observe(canvas);
    document.addEventListener("visibilitychange", schedule);
    reduced.addEventListener("change", schedule);
    window.addEventListener("phemios-preferences", draw);
    schedule();
    onCleanup(() => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", schedule);
      reduced.removeEventListener("change", schedule);
      window.removeEventListener("phemios-preferences", draw);
      cancelAnimationFrame(frame);
    });
  });
  return (
    <canvas
      class="audio-scene"
      ref={(element) => {
        canvas = element;
      }}
      tabindex="0"
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        event.currentTarget.focus();
        drag = { id: event.pointerId, x: event.clientX, y: event.clientY, yaw, pitch };
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        if (drag?.id === event.pointerId) {
          [yaw, pitch] = orbitDrag(
            drag.yaw,
            drag.pitch,
            event.clientX - drag.x,
            event.clientY - drag.y,
          );
          draw();
        }
      }}
      onPointerUp={() => {
        drag = undefined;
      }}
      onPointerCancel={() => {
        drag = undefined;
      }}
      onKeyDown={(event) => {
        if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home"].includes(event.key))
          return;
        event.preventDefault();
        if (event.key === "Home") {
          yaw = 0;
          pitch = 0;
        } else {
          [yaw, pitch] = orbitDrag(
            yaw,
            pitch,
            event.key === "ArrowLeft" ? -15 : event.key === "ArrowRight" ? 15 : 0,
            event.key === "ArrowUp" ? -15 : event.key === "ArrowDown" ? 15 : 0,
          );
        }
        draw();
      }}
      role="img"
      aria-label={t("Animation 3D réactive au son. La pause fige l’animation.")}
    />
  );
}

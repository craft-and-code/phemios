import { drawFloatingDepth } from "../visualizer/floating-depth";
import { floatingObjects, animationRuns } from "../visualizer/floating";
import { createEffect, onCleanup, onMount } from "solid-js";
import { t } from "../i18n";
import { orbit, orbitDrag, orbitField } from "../visualizer/orbit";
import { createParticleField, type Scene } from "../visualizer/particles";
/** Perspective-projected 3D particles follow native consumed-sample RMS envelopes; pause holds the last pose. */
export function AudioScene(props: { scene: Scene; playing: boolean; levels: readonly number[] }) {
  let canvas: HTMLCanvasElement | undefined,
    frame = 0,
    clock = 0,
    last = 0,
    lastDraw = 0,
    bands: readonly number[] = [0, 0, 0, 0],
    width = 0,
    height = 0,
    color = "";
  let yaw = 0,
    pitch = 0,
    drag: { id: number; x: number; y: number; yaw: number; pitch: number } | undefined;
  let field: ReturnType<typeof createParticleField> | undefined;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  function draw() {
    if (!canvas || document.hidden) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const ratio = Math.min(2, window.devicePixelRatio);
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
    const scale = Math.min(width, height) * 0.32;
    if (props.scene === "floating") drawFloatingDepth(ctx, width, height, clock, yaw, pitch, color);
    const energy = reduced.matches ? [0, 0, 0, 0] : bands;
    const points =
      props.scene === "floating"
        ? floatingObjects(clock, energy).map((p) => orbit(p, yaw, pitch))
        : orbitField(
            (field ??= createParticleField()).update(props.scene, clock, energy),
            yaw,
            pitch,
          );
    points.sort((a, b) => b.z - a.z);
    for (const point of points) {
      const perspective = 3.4 / (3.4 + point.z),
        x = width / 2 + point.x * scale * perspective,
        y = height / 2 + point.y * scale * perspective;
      ctx.globalAlpha = Math.max(0.12, Math.min(1, (1.9 - point.z) / 3 + 0.15 * point.energy));
      ctx.fillStyle = color;
      if (props.scene === "floating") {
        const radius = (8 + point.energy * 14) * perspective;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(clock * 0.3 + point.z);
        // Foreshortening changes with the object's orbit, while projected size/opacity expose its depth.
        ctx.scale(0.55 + 0.45 * Math.abs(Math.cos(clock * 0.4 + point.z)), 1);
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.shadowColor = color;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        if (point.z > 0) {
          // Small musical notes replace decorative rings without requiring image assets.
          ctx.ellipse(
            -radius * 0.25,
            radius * 0.35,
            radius * 0.3,
            radius * 0.2,
            -0.4,
            0,
            Math.PI * 2,
          );
          ctx.fill();
          ctx.beginPath();
          ctx.moveTo(0, radius * 0.35);
          ctx.lineTo(0, -radius);
          ctx.bezierCurveTo(
            radius * 0.9,
            -radius * 0.8,
            radius * 0.8,
            -0.1 * radius,
            radius * 0.35,
            0,
          );
          ctx.stroke();
        } else {
          // A sparse paper-plane silhouette crosses the perspective stage.
          ctx.moveTo(-radius, -radius * 0.55);
          ctx.lineTo(radius, 0);
          ctx.lineTo(-radius * 0.5, radius * 0.7);
          ctx.lineTo(-radius * 0.3, 0);
          ctx.closePath();
          ctx.moveTo(-radius * 0.3, 0);
          ctx.lineTo(radius, 0);
          ctx.stroke();
        }
        ctx.restore();
        continue;
      }
      ctx.beginPath();
      ctx.arc(x, y, Math.max(0.6, (1.1 + point.energy) * perspective), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  // Layout and theme can change independently of the audio clock; neither needs per-frame reads.
  function refreshSurface() {
    if (!canvas || document.hidden) return;
    width = canvas.clientWidth;
    height = canvas.clientHeight;
    color = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim();
    draw();
  }
  function tick(timestamp: number) {
    if (!animationRuns(props.scene !== "off", props.playing, document.hidden, reduced.matches)) {
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
    refreshSurface();
    if (animationRuns(props.scene !== "off", props.playing, document.hidden, reduced.matches))
      frame = requestAnimationFrame(tick);
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
    const observer = new ResizeObserver(refreshSurface);
    if (canvas) observer.observe(canvas);
    document.addEventListener("visibilitychange", schedule);
    reduced.addEventListener("change", schedule);
    window.addEventListener("phemios-preferences", refreshSurface);
    schedule();
    onCleanup(() => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", schedule);
      reduced.removeEventListener("change", schedule);
      window.removeEventListener("phemios-preferences", refreshSurface);
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

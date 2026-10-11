import type { Particle } from "./particles";
import { orbit } from "./orbit";
/** Perspective uses one bounded camera for the sparse stage; nearer geometry is larger and clearer. */
export function depthProjection(point: Particle, width: number, height: number) {
  const perspective = 5.8 / Math.max(1, 5.8 + point.z),
    scale = Math.min(width, height) * 0.24;
  return {
    x: width / 2 + point.x * scale * perspective,
    y: height / 2 + point.y * scale * perspective,
    perspective,
    alpha: Math.max(0.025, Math.min(0.16, 0.1 - point.z * 0.025)),
  };
}
/** A fixed 14-line floor and three orbit guides establish depth without a new renderer or particle workload. */
export function drawFloatingDepth(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  clock: number,
  yaw: number,
  pitch: number,
  color: string,
) {
  const project = (x: number, y: number, z: number) =>
    depthProjection(
      orbit({ x, y, z, energy: 0 }, yaw + Math.sin(clock * 0.12) * 0.08, pitch - 0.12),
      width,
      height,
    );
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 0.8;
  const line = (a: ReturnType<typeof project>, b: ReturnType<typeof project>) => {
    ctx.globalAlpha = (a.alpha + b.alpha) / 2;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  };
  for (let i = -3; i <= 3; i++) {
    line(project(i * 0.72, 1.25, -2.2), project(i * 0.72, 1.25, 2.2));
    line(project(-2.2, 1.25, i * 0.72), project(2.2, 1.25, i * 0.72));
  }
  ctx.setLineDash([2, 10]);
  for (let ring = 0; ring < 3; ring++) {
    const radius = 1 + ring * 0.36;
    for (let i = 0; i < 48; i++) {
      const angle = (i * Math.PI) / 24,
        next = ((i + 1) * Math.PI) / 24;
      line(
        project(Math.cos(angle) * radius, Math.sin(angle) * 0.25 - 0.2, Math.sin(angle) * radius),
        project(Math.cos(next) * radius, Math.sin(next) * 0.25 - 0.2, Math.sin(next) * radius),
      );
    }
  }
  ctx.restore();
}

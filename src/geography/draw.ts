import { project, type Country, type Point } from "./projection";
import { geoPath } from "d3-geo";
import { countryGeometry, globeProjection } from "./geometry";
/** Draw only the front hemisphere, without a permanent animation loop. */
export function drawGlobe(
  canvas: HTMLCanvasElement,
  countries: readonly Country[],
  center: Point,
  zoom: number,
  selected: ReadonlySet<string>,
  available: ReadonlySet<string>,
  keyboardFocus = false,
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const w = canvas.clientWidth,
    h = canvas.clientHeight,
    ratio = Math.min(window.devicePixelRatio, 2);
  if (!w || !h) return;
  canvas.width = w * ratio;
  canvas.height = h * ratio;
  ctx.scale(ratio, ratio);
  const radius = Math.min(w, h) * 0.42 * zoom,
    cx = w / 2,
    cy = h / 2;
  ctx.clearRect(0, 0, w, h);
  const halo = ctx.createRadialGradient(cx, cy, radius * 0.8, cx, cy, radius * 1.2);
  halo.addColorStop(0, "#43e0f000");
  halo.addColorStop(0.65, "#43e0f02b");
  halo.addColorStop(1, "#43e0f000");
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, w, h);
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.clip();
  const sea = ctx.createRadialGradient(cx - radius * 0.3, cy - radius * 0.3, 0, cx, cy, radius);
  sea.addColorStop(0, "#123f45");
  sea.addColorStop(1, "#040f19");
  ctx.fillStyle = sea;
  ctx.fillRect(0, 0, w, h);
  const path = geoPath(globeProjection(center, radius, [cx, cy]), ctx);
  for (const country of countries) {
    ctx.beginPath();
    path(countryGeometry(country));
    ctx.fillStyle = selected.has(country.code)
      ? "#d8f36a"
      : available.has(country.code)
        ? "#317d6a"
        : "#153740";
    ctx.fill("evenodd");
    ctx.strokeStyle = selected.has(country.code) ? "#ecffa0" : "#42949c";
    ctx.lineWidth = selected.has(country.code) ? 1.5 : 0.55;
    ctx.stroke();
  }
  ctx.strokeStyle = "#4acbd02b";
  ctx.lineWidth = 0.5;
  const line = (points: Point[]) => {
    ctx.beginPath();
    let active = false;
    for (const point of points) {
      const p = project(point, center);
      if (p.z < 0) {
        active = false;
        continue;
      }
      if (active) ctx.lineTo(cx + p.x * radius, cy + p.y * radius);
      else ctx.moveTo(cx + p.x * radius, cy + p.y * radius);
      active = true;
    }
    ctx.stroke();
  };
  for (let latitude = -60; latitude <= 60; latitude += 30)
    line(Array.from({ length: 181 }, (_, i) => [i * 2 - 180, latitude]));
  for (let longitude = -180; longitude < 180; longitude += 30)
    line(Array.from({ length: 91 }, (_, i) => [longitude, i * 2 - 90]));
  ctx.restore();
  ctx.strokeStyle = keyboardFocus ? "#d8f36a" : "#74dce488";
  ctx.lineWidth = keyboardFocus ? 3 : 1;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = "#4e9ba644";
  ctx.beginPath();
  ctx.ellipse(cx, cy, radius * 1.11, radius * 0.28, -0.22, 0, Math.PI * 2);
  ctx.stroke();
}

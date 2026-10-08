/** Perspective projection of a bounded Fibonacci sphere; coordinates carry no music meaning. */
export function relationSpace(count: number, yaw: number, pitch: number, zoom: number) {
  if (
    !Number.isInteger(count) ||
    count < 0 ||
    count > 16 ||
    ![yaw, pitch, zoom].every(Number.isFinite) ||
    zoom < 0.6 ||
    zoom > 1.6
  )
    throw new Error("Espace de relations invalide.");
  return Array.from({ length: count }, (_, index) => {
    const y = 1 - (2 * (index + 0.5)) / count,
      radius = Math.sqrt(1 - y * y),
      angle = index * Math.PI * (3 - Math.sqrt(5));
    const x = radius * Math.cos(angle),
      z = radius * Math.sin(angle),
      xx = x * Math.cos(yaw) + z * Math.sin(yaw),
      zz = z * Math.cos(yaw) - x * Math.sin(yaw);
    const yy = y * Math.cos(pitch) - zz * Math.sin(pitch),
      depth = y * Math.sin(pitch) + zz * Math.cos(pitch),
      scale = 3.4 / (3.4 - depth);
    return {
      index,
      x: 450 + xx * 235 * scale * zoom,
      y: 255 + yy * 170 * scale * zoom,
      depth,
      scale,
    };
  }).sort((a, b) => a.depth - b.depth);
}

interface ProjectedNode {
  index: number;
  x: number;
  y: number;
}
/** Perimeter labels reserve one readable row per node when projected names would overlap. */
export function relationLabels(points: readonly ProjectedNode[]) {
  if (points.length <= 6)
    return points.map((p) => ({ ...p, y: p.y + 42, anchor: "middle" as const }));
  const labels: { index: number; x: number; y: number; anchor: "start" | "end" }[] = [];
  for (const left of [true, false]) {
    const side = points
      .filter((p) => p.x < 450 === left)
      .sort((a, b) => a.y - b.y || a.index - b.index);
    side.forEach((p, i) =>
      labels.push({
        index: p.index,
        x: left ? 12 : 888,
        y: side.length === 1 ? 255 : 42 + (i * 426) / (side.length - 1),
        anchor: left ? "start" : "end",
      }),
    );
  }
  return labels;
}
/** Darkness follows projected spatial distance only, never inferred musical proximity. */
export function relationBrightness(x: number, y: number) {
  return 1 - 0.6 * Math.min(1, Math.hypot(x - 450, y - 255) / 400);
}

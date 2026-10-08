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

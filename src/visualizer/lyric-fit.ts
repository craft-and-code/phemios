/** Scale the final rotated phrase into its actual stage, reserving space for the upward arrival. */
export function lyricFit(input: {
  width: number;
  height: number;
  angle: number;
  stageWidth: number;
  stageHeight: number;
  x: number;
  y: number;
}) {
  if (input.width <= 0 || input.height <= 0) return 1;
  const radians = (input.angle * Math.PI) / 180,
    cosine = Math.abs(Math.cos(radians)),
    sine = Math.abs(Math.sin(radians)),
    width = cosine * input.width + sine * input.height,
    height = sine * input.width + cosine * input.height,
    x = (input.x * input.stageWidth) / 100,
    y = (input.y * input.stageHeight) / 100,
    availableWidth = Math.max(0, 2 * Math.min(x, input.stageWidth - x) - 32),
    availableHeight = Math.max(0, 2 * Math.min(y, input.stageHeight - y) - 112);
  return Math.min(1, availableWidth / width, availableHeight / height);
}

import type { Point } from "./projection";

/** Test-only canvas recorder; filled country paths exclude the separate ocean rectangle. */
export function recordingCanvas() {
  let path: Point[] = [];
  const fills: Point[][] = [];
  const context = {
    createRadialGradient: () => ({ addColorStop() {} }),
    clearRect() {},
    fillRect() {},
    scale() {},
    save() {},
    restore() {},
    clip() {},
    beginPath() {
      path = [];
    },
    moveTo(x: number, y: number) {
      path.push([x, y]);
    },
    lineTo(x: number, y: number) {
      path.push([x, y]);
    },
    arc() {},
    ellipse() {},
    closePath() {},
    stroke() {},
    fill() {
      fills.push([...path]);
    },
  };
  const canvas = { clientWidth: 100, clientHeight: 100, getContext: () => context };
  return { canvas: canvas as unknown as HTMLCanvasElement, fills };
}

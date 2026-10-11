import { expect, it } from "vitest";
import { lyricFit } from "./lyric-fit";
it("keeps a large inclined phrase within the stage, including its arrival margin", () => {
  for (const angle of [-55, -45, 45, 55]) {
    const input = {
      width: 620,
      height: 270,
      angle,
      stageWidth: 700,
      stageHeight: 400,
      x: 50,
      y: 50,
    };
    const result = lyricFit(input);
    const radians = (angle * Math.PI) / 180;
    const width =
      Math.abs(Math.cos(radians)) * input.width + Math.abs(Math.sin(radians)) * input.height;
    const height =
      Math.abs(Math.sin(radians)) * input.width + Math.abs(Math.cos(radians)) * input.height;
    expect(result).toBeGreaterThan(0);
    expect(width * result).toBeLessThanOrEqual(668);
    expect(height * result).toBeLessThanOrEqual(336);
  }
});
it("retains normal size when it fits and adapts to moved lyrics and a narrow drawer layout", () => {
  const input = {
    width: 180,
    height: 30,
    angle: 0,
    stageWidth: 900,
    stageHeight: 500,
    x: 50,
    y: 50,
  };
  expect(lyricFit(input)).toBe(1);
  expect(
    lyricFit({ ...input, width: 500, height: 250, angle: 50, stageWidth: 350, y: 80 }),
  ).toBeLessThan(0.3);
});

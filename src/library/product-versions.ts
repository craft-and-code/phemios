/** Older engines may omit version metadata; malformed supplied values remain errors. */
export function engineVersions(
  value: unknown,
): { aede: string; flaccompagnon: string } | undefined {
  if (value === undefined) return;
  if (!value || typeof value !== "object") throw new Error("Invalid engine versions");
  const item = value as Record<string, unknown>;
  for (const key of ["aede", "flaccompagnon"]) {
    if (
      typeof item[key] !== "string" ||
      item[key].length > 64 ||
      !/^\d+\.\d+\.\d+(?:[-+][A-Za-z0-9.-]+)?$/.test(item[key])
    )
      throw new Error("Invalid engine versions");
  }
  return { aede: item.aede as string, flaccompagnon: item.flaccompagnon as string };
}

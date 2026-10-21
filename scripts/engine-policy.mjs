/** Compare validated stable release versions without lexical ordering (0.10 > 0.9). */
export function compareVersions(a, b) {
  const parse = (value) => {
    if (typeof value !== "string" || !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(value))
      throw new Error("Invalid stable engine version.");
    return value.split(".").map(BigInt);
  };
  const x = parse(a),
    y = parse(b);
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] > y[i] ? 1 : -1;
  return 0;
}
export { stableRelease as publishedRelease } from "./audio-source.mjs";
/** A published engine must include at least the declared compatible server/core versions. */
export function requireEngineVersions(actual, minimum) {
  for (const key of ["aede", "flaccompagnon"])
    if (compareVersions(actual?.[key], minimum[key]) < 0)
      throw new Error(
        `Embedded ${key} ${actual[key]} is older than required ${minimum[key]}. Update the engine explicitly.`,
      );
}

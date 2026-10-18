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
/** Admit published stable metadata. Temporary release tags cannot select executable source. */
export function publishedRelease(value) {
  if (
    !value ||
    value.draft !== false ||
    value.prerelease !== false ||
    typeof value.published_at !== "string" ||
    !Number.isFinite(Date.parse(value.published_at)) ||
    typeof value.tag_name !== "string" ||
    !/^v?\d+\.\d+\.\d+$/.test(value.tag_name)
  )
    throw new Error(
      "The latest release needs a published stable version tag before engine update.",
    );
  const version = value.tag_name.replace(/^v/, "");
  compareVersions(version, version);
  return { tag: value.tag_name, version };
}
/** A published engine must include at least the declared compatible server/core versions. */
export function requireEngineVersions(actual, minimum) {
  for (const key of ["aede", "flaccompagnon"])
    if (compareVersions(actual?.[key], minimum[key]) < 0)
      throw new Error(
        `Embedded ${key} ${actual[key]} is older than required ${minimum[key]}. Update the engine explicitly.`,
      );
}

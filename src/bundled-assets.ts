/** Authored local assets follow Vite's deployment base in native, root Web and project-subdirectory builds. */
export function bundledAsset(
  name: "favicon.svg" | "demo/landscape.svg" | "geography/countries.json",
) {
  return `${import.meta.env.BASE_URL}${name}`;
}

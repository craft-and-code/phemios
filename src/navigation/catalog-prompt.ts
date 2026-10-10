import type { Route } from "./routes";
/** An empty artist graph is valid for albumless tracks and is never a connection failure. */
export function needsCatalogPrompt(
  route: Route,
  artists: number,
  connected: boolean,
  busy: boolean,
): boolean {
  return (
    !connected &&
    artists === 0 &&
    !busy &&
    route.kind === "section" &&
    ["artists", "albums", "compilations", "countries", "genres", "recent"].includes(route.section)
  );
}

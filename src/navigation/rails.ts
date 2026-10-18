import type { Route } from "./routes";
/** Catalog bounds stay available when returning to lists, but never filter detail pages. */
export function catalogRails(route: Route): boolean {
  return (
    route.kind === "section" &&
    ["artists", "albums", "compilations", "countries", "genres", "composers"].includes(
      route.section,
    )
  );
}

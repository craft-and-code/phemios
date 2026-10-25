import { createSignal, type Accessor } from "solid-js";
import { isCollectionMenuId } from "./collection-menu";
import type { FilterScope } from "./scoped-filters";
export type CatalogPresentation = "list" | "grid" | "cover-flow";
/** Only album catalogs expose three presentations; other lists retain list/grid selection. */
export function supportsCoverFlow(scope: FilterScope): boolean {
  return isCollectionMenuId(scope) || ["albums", "compilations", "composers"].includes(scope);
}
/** Presentation choices are session memory per view, independent from private selection filters. */
export function createCatalogPresentation(scope: Accessor<FilterScope>) {
  const [saved, setSaved] = createSignal<Partial<Record<FilterScope, CatalogPresentation>>>({});
  const value = (): CatalogPresentation =>
    saved()[scope()] ??
    (supportsCoverFlow(scope()) && scope() !== "compilations" ? "cover-flow" : "grid");
  return {
    value,
    resizable: () =>
      value() === "grid" ||
      (value() === "list" && (scope() === "genres" || supportsCoverFlow(scope()))),
    select(next: CatalogPresentation): boolean {
      if (next === "cover-flow" && !supportsCoverFlow(scope())) return false;
      setSaved((held) => ({ ...held, [scope()]: next }));
      return true;
    },
  };
}

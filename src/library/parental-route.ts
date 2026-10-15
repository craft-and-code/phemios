import type { Route } from "../navigation/routes";
import { referenceSource, type SourceId } from "./sources";
/** Dispose/refuse account resources on policy failure while preserving access to recovery settings. */
export function parentalRouteAllowed(
  route: Route,
  available: (source?: SourceId) => boolean,
): boolean {
  if ("reference" in route) return available(referenceSource(route.reference));
  return (route.kind === "section" && route.section === "settings") || available();
}

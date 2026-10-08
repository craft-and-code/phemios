import { createMemo } from "solid-js";
import type { AccountSession } from "./server";
/** Presentation object changes must not restart an entity's private reads or write queue. */
export function annotationScope(
  reference: () => string,
  session: () => AccountSession | undefined,
) {
  const stableReference = createMemo(reference);
  return createMemo(() => ({ reference: stableReference(), session: session() }));
}

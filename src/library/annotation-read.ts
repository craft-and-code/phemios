import { createMemo, createResource, onCleanup } from "solid-js";
import { t } from "../i18n";
import { annotationScope } from "./annotation-scope";
import { parseAnnotation } from "./annotation-loading";
import type { AccountSession } from "./server";
/** Detail reads expose only their exact reference/session scope, including after logout.
 * Solid resources may retain a previous value while disabled or loading; this facade hides it.
 * Errors stay inside the optional panel. Refetch preserves same-owner drafts in the caller.
 */
export function createAnnotationRead(
  reference: () => string,
  session: () => AccountSession | undefined,
  request: (reference: string) => Promise<unknown>,
) {
  const scope = annotationScope(reference, session);
  let disposed = false;
  onCleanup(() => {
    disposed = true;
  });
  const [answer, { refetch }] = createResource(
    () => (scope().session ? scope() : false),
    async (held) => {
      try {
        const raw = (await request(held.reference)) as { annotation: unknown };
        if (!raw || typeof raw !== "object" || !("annotation" in raw))
          throw new Error(t("Annotations illisibles :"));
        return {
          scope: held,
          annotation:
            raw.annotation === null ? null : parseAnnotation(raw.annotation, held.reference),
          error: "",
        };
      } catch (failure) {
        return { scope: held, annotation: undefined, error: String(failure) };
      }
    },
  );
  const admitted = createMemo(() => {
    const held = scope(),
      row = answer();
    return !disposed && held.session && row?.scope === held ? row : undefined;
  });
  return {
    scope,
    current: () => (disposed ? undefined : admitted()?.annotation),
    loading: () => !!scope().session && answer.loading,
    error: () => (disposed ? "" : (admitted()?.error ?? "")),
    refetch,
  };
}

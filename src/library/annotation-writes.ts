import { parseAnnotationResponse } from "./annotation-loading";
import type { Annotation } from "./server";
export type AnnotationPatch = Partial<Pick<Annotation, "rating" | "loved" | "note" | "tags">>;
/** Serialize explicit field patches; validate exact targets only while the captured session is active. */
export function annotationWriter(options: {
  reference: string;
  active: () => boolean;
  request: (patch: AnnotationPatch) => Promise<unknown>;
  publish: (annotation: Annotation | null) => void;
  pending: (count: number) => void;
}) {
  let tail: Promise<unknown> = Promise.resolve(),
    count = 0;
  return {
    write(patch: AnnotationPatch): Promise<Annotation | null | undefined> {
      options.pending(++count);
      const result = tail
        .then(async () => {
          if (!options.active()) return undefined;
          const answer = await options.request(patch);
          if (!options.active()) return undefined;
          const saved = parseAnnotationResponse(answer, options.reference);
          options.publish(saved);
          return saved;
        })
        .finally(() => {
          count--;
          if (options.active()) options.pending(count);
        });
      tail = result.catch(() => undefined);
      return result;
    },
  };
}

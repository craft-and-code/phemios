import type { Annotation } from "./server";
export type AnnotationPatch = Partial<Pick<Annotation, "rating" | "loved" | "note" | "tags">>;
/** Serialize explicit field patches; never publish a response into another session. */
export function annotationWriter(options: {
  active: () => boolean;
  request: (patch: AnnotationPatch) => Promise<Annotation | null>;
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
          if (options.active()) options.publish(answer);
          return answer;
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

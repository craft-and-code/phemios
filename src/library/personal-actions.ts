import { createEffect, on, onCleanup } from "solid-js";
import type { Section } from "../navigation/routes";
import type { AccountSession } from "./server";
import type { SourceId } from "./sources";
/** Reset retained drafts and capture admission for delayed personal action acknowledgements. */
export function createPersonalActions(
  section: () => Section,
  session: () => AccountSession | undefined,
  source: () => SourceId,
  reset: () => void,
) {
  let alive = true,
    generation = 0;
  createEffect(
    on([section, session, source], () => {
      generation++;
      reset();
    }),
  );
  onCleanup(() => {
    alive = false;
  });
  return {
    capture: () => {
      const heldSession = session(),
        heldSource = source(),
        heldSection = section(),
        epoch = generation;
      return () =>
        alive &&
        !!heldSession &&
        epoch === generation &&
        heldSession === session() &&
        heldSource === source() &&
        heldSection === section();
    },
  };
}

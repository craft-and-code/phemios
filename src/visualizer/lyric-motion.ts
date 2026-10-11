import { createMemo, type Accessor } from "solid-js";
import { phraseOrientation } from "./floating";
/** Clock polls retain one phrase node; a distinct supplied cue (even repeated words) restarts its arrival. */
export function createLyricPhrase(
  text: Accessor<string>,
  cue: Accessor<string | number>,
  floating: Accessor<boolean>,
) {
  return createMemo(
    () =>
      text()
        ? { text: text(), cue: cue(), angle: floating() ? phraseOrientation(text()) : 0 }
        : undefined,
    undefined,
    { equals: (a, b) => a?.text === b?.text && a?.cue === b?.cue && a?.angle === b?.angle },
  );
}

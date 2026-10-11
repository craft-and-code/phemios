import { createMemo, type Accessor } from "solid-js";
import { lyricTreatment, type LyricTypography } from "./lyric-treatment";
/** Clock polls retain one phrase node; a distinct supplied cue (even repeated words) restarts its arrival. */
export function createLyricPhrase(
  text: Accessor<string>,
  cue: Accessor<string | number>,
  floating: Accessor<boolean>,
  typography: Accessor<LyricTypography> = () => ({ track: "", phase: 0 }),
) {
  return createMemo(
    () => {
      if (!text()) return;
      const treatment = floating() ? lyricTreatment(text(), cue(), typography()) : undefined;
      return { text: text(), cue: cue(), angle: treatment?.angle ?? 0, treatment };
    },
    undefined,
    {
      equals: (a, b) =>
        a?.text === b?.text &&
        a?.cue === b?.cue &&
        a?.angle === b?.angle &&
        a?.treatment?.font === b?.treatment?.font,
    },
  );
}

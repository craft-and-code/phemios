import { createEffect, createMemo, createSignal, on, type Accessor } from "solid-js";
import type { Lyrics } from "../library/lyrics";
/** Manual words have no invented timing; keep the chosen line until the track changes. */
export function createUntimedLyrics(
  reference: Accessor<string | undefined>,
  lyrics: Accessor<Lyrics | null | undefined>,
) {
  const [index, setIndex] = createSignal(0);
  const lines = createMemo(() =>
    lyrics()?.synced === false
      ? lyrics()!
          .lines.map((line) => line.text)
          .filter((text) => text.trim())
      : [],
  );
  // Native clock polls replace the state object even when its track identity is unchanged.
  const track = createMemo(reference);
  createEffect(on(track, () => setIndex(0)));
  createEffect(
    on(
      () => lines().length,
      (length) => setIndex((value) => Math.min(value, Math.max(0, length - 1))),
    ),
  );
  return {
    lines,
    index,
    previous: () => setIndex((value) => Math.max(0, value - 1)),
    next: () => setIndex((value) => Math.min(Math.max(0, lines().length - 1), value + 1)),
  };
}

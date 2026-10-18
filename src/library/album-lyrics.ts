import { createSignal } from "solid-js";
import { createQueueLyrics } from "./queue-lyrics-controller";
/** The app owns an album batch, so navigating away never interrupts its remaining downloads. */
export function createAlbumLyrics(options: Omit<Parameters<typeof createQueueLyrics>[0], "queue">) {
  const [selection, setSelection] = createSignal<{
    release: string;
    tracks: readonly { reference: string; title: string }[];
  }>({ release: "", tracks: [] });
  const controller = createQueueLyrics({ ...options, queue: () => selection().tracks });
  return {
    controller,
    target: () => selection().release,
    select(release: string, tracks: readonly { reference: string; title: string }[]) {
      if (controller.busy()) return selection().release === release;
      const previous = selection();
      if (
        previous.release !== release ||
        previous.tracks.length !== tracks.length ||
        previous.tracks.some((row, index) => row.reference !== tracks[index]?.reference)
      )
        setSelection({ release, tracks: [...tracks] });
      return true;
    },
  };
}

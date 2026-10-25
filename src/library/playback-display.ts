import type { PlayableSelection } from "./playback-selection";
import type { PlaybackState } from "./playback-state";

/** Choose footer metadata without assigning a prepared occurrence a native playback identity. */
export function playbackDisplay(
  current: PlayableSelection | undefined,
  state: Pick<PlaybackState, "status" | "reference">,
  queue: readonly PlayableSelection[],
): PlayableSelection | undefined {
  if (current) return current;
  if (state.status !== "idle" || state.reference) return undefined;
  return queue[0];
}

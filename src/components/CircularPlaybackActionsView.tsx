import type { JSX } from "solid-js";
/** A persistent corner badge keeps Add separate from the centred circular Play hit target. */
export function CircularPlaybackActionsView(props: { play: JSX.Element; append: JSX.Element }) {
  return (
    <span class="circular-play-actions">
      {props.play}
      {props.append}
    </span>
  );
}

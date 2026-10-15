import type { JSX } from "solid-js";
/** One positioned cluster keeps Add immediately before the final Play action. */
export function PlaybackActionsView(props: {
  class?: string | undefined;
  append: JSX.Element;
  play: JSX.Element;
}) {
  return (
    <div class={`cover-play media-actions ${props.class ?? ""}`}>
      {props.append}
      {props.play}
    </div>
  );
}

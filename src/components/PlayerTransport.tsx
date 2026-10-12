import type { JSX } from "solid-js";
/** Fixed footer rows preserve the Play and volume axes across music, podcasts and live radio. */
export function PlayerTransport(props: { controls: JSX.Element; timeline: JSX.Element }) {
  return (
    <div class="transport">
      <div class="transport-buttons">{props.controls}</div>
      {props.timeline}
    </div>
  );
}

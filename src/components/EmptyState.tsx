import type { JSX } from "solid-js";
import { Icon } from "./Icon";
/** A shared result state fills the remaining page space and keeps its message accessible. */
export function EmptyState(props: { icon?: string; children: JSX.Element }) {
  return (
    <div class="empty-state" role="status">
      <Icon name={props.icon ?? "disc"} />
      <p>{props.children}</p>
    </div>
  );
}

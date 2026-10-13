import { Show, type JSX } from "solid-js";
import { PageLoader } from "./PageLoader";
/** All statistics reads settle before revealing one coherent body; only one page activity is rendered. */
export function StatisticsContent(props: { busy: boolean; children: JSX.Element }) {
  return (
    <Show when={!props.busy} fallback={<PageLoader />}>
      {props.children}
    </Show>
  );
}

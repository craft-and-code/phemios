import { Dynamic } from "solid-js/web";
import { resolveIcon } from "./icon-symbols";

/** Decorative Lucide glyphs; Stop has a small optical inset without changing its control size. */
export function Icon(props: { name: string }) {
  return (
    <Dynamic
      component={resolveIcon(props.name)}
      size={18}
      viewBox={props.name === "stop" ? "-2 -2 28 28" : "0 0 24 24"}
      strokeWidth={1.6}
      color="currentColor"
      aria-hidden="true"
    />
  );
}

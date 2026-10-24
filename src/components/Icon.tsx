import { Dynamic } from "solid-js/web";
import { resolveIcon } from "./icon-symbols";

/** Consistent decorative Lucide glyphs; accessible names belong to their labelled controls. */
export function Icon(props: { name: string }) {
  return (
    <Dynamic
      component={resolveIcon(props.name)}
      size={18}
      strokeWidth={1.6}
      color="currentColor"
      aria-hidden="true"
    />
  );
}

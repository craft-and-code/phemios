import { Show } from "solid-js";
import { useLibrary } from "../library/context";
import { referenceSource, sourceLabel } from "../library/sources";
/** Origin labels appear only where two retained catalogs can otherwise be confused. */
export function SourceBadge(props: { reference: string }) {
  const library = useLibrary();
  return (
    <Show when={library.origins().length > 1}>
      <span class="source-badge">{sourceLabel(referenceSource(props.reference))}</span>
    </Show>
  );
}

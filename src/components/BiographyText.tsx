import { createMemo, For, Show } from "solid-js";
import { useLibrary } from "../library/context";
import { biographyLinks, type BiographyPart } from "../library/biography-links";
/** Stored prose remains unchanged; links resolve only names currently present in its source. */
export function BiographyText(props: {
  text: string;
  reference: string;
  linker?: (text: string) => BiographyPart[];
}) {
  const library = useLibrary(),
    parts = createMemo(() =>
      props.linker
        ? props.linker(props.text)
        : biographyLinks(props.text, library.artists(), props.reference),
    );
  return (
    <For each={parts()}>
      {(part) => (
        <Show when={part.reference} fallback={part.text}>
          {(reference) => (
            <a class="biography-link" href={`#/artist/${encodeURIComponent(reference())}`}>
              {part.text}
            </a>
          )}
        </Show>
      )}
    </For>
  );
}

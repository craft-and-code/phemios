import { Show, createMemo } from "solid-js";
import { trackMetadataTarget, type MetadataBrowse } from "../library/track-metadata-links";
import type { TrackDetail } from "../library/track-detail";
import { useLibrary } from "../library/context";
/** File metadata preserves its original text while linking source-qualified catalogue identities. */
export function TrackMetadataValue(props: {
  field: string;
  value: string;
  detail: TrackDetail;
  onBrowse: (target: MetadataBrowse) => void;
}) {
  const library = useLibrary();
  const target = createMemo(() =>
    trackMetadataTarget(
      props.field,
      props.value,
      props.detail,
      library.artists(),
      library.albums(),
    ),
  );
  return (
    <Show when={target()} fallback={props.value}>
      {(value) => (
        <Show
          when={value().kind === "route"}
          fallback={
            <button class="metadata-link" onClick={() => props.onBrowse(value() as MetadataBrowse)}>
              {props.value}
            </button>
          }
        >
          <a class="metadata-link" href={(value() as { href: string }).href}>
            {props.value}
          </a>
        </Show>
      )}
    </Show>
  );
}

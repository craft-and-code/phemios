import { labelDestination } from "../library/label-navigation";
import { requestAede } from "../platform/desktop";
import { Show, createMemo, createSignal, onCleanup } from "solid-js";
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
  const library = useLibrary(),
    [busy, setBusy] = createSignal(false),
    [error, setError] = createSignal("");
  let alive = true;
  onCleanup(() => {
    alive = false;
  });
  const target = createMemo(() =>
    trackMetadataTarget(
      props.field,
      props.value,
      props.detail,
      library.artists(),
      library.albums(),
    ),
  );
  async function activate() {
    const value = target(),
      reference = props.detail.reference,
      session = library.sessionFor(reference);
    if (!value || value.kind === "route") return;
    if (value.kind === "browse") {
      props.onBrowse(value);
      return;
    }
    if (!session || busy()) return;
    setBusy(true);
    setError("");
    try {
      const raw = await requestAede(
        "/api/v1/label",
        { name: value.name },
        "GET",
        undefined,
        value.source,
      );
      if (
        !alive ||
        target() !== value ||
        props.detail.reference !== reference ||
        library.sessionFor(reference) !== session
      )
        return;
      window.location.hash = labelDestination(raw, value.name, value.source);
    } catch (failure) {
      if (
        alive &&
        target() === value &&
        props.detail.reference === reference &&
        library.sessionFor(reference) === session
      )
        setError(String(failure));
    } finally {
      if (alive) setBusy(false);
    }
  }
  return (
    <Show when={target()} fallback={props.value}>
      {(value) => (
        <Show
          when={value().kind === "route"}
          fallback={
            <>
              <button
                class="metadata-link"
                disabled={
                  busy() ||
                  (value().kind === "label" && !library.sessionFor(props.detail.reference))
                }
                aria-busy={busy()}
                onClick={() => void activate()}
              >
                {props.value}{" "}
                <Show when={busy()}>
                  <span class="spinner" aria-hidden="true" />
                </Show>
              </button>
              <Show when={error()}>
                <small class="metadata-error" role="alert">
                  {error()}
                </small>
              </Show>
            </>
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

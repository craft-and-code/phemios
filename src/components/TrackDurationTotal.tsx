import { createMemo, Show } from "solid-js";
import { t } from "../i18n";
import { collectionDuration } from "../library/detail-format";
import { queueDuration } from "../library/queue-duration";
/** Aggregate the complete loaded album, preserving unknown durations rather than calling them zero. */
export function TrackDurationTotal(props: {
  tracks: readonly { reference: string; duration_ms: number | null }[] | undefined;
}) {
  const total = createMemo(() => {
    const rows = props.tracks ?? [];
    return queueDuration(rows, new Map(rows.map((row) => [row.reference, row.duration_ms])));
  });
  return (
    <Show when={props.tracks?.length}>
      <small class="track-duration-total" aria-label={t("Durée totale")}>
        {t("Durée totale")} ·{" "}
        {total().unknown === props.tracks!.length
          ? t("Inconnue")
          : collectionDuration(total().milliseconds)}
        <Show when={total().unknown > 0 && total().unknown < props.tracks!.length}>
          {" "}
          · {t("{0} durées inconnues", total().unknown)}
        </Show>
      </small>
    </Show>
  );
}

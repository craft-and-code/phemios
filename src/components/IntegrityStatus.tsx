import { For, Show } from "solid-js";
import { t } from "../i18n";
import type { IntegrityCounts } from "../library/analysis-coverage";
/** Separate unsupported/unknown evidence from a successful checksum comparison. */
export function IntegrityStatus(props: { value: IntegrityCounts | undefined }) {
  const entries = () =>
    props.value
      ? [
          { count: props.value.ok, label: "OK", kind: "ok" },
          { count: props.value.ko, label: "KO", kind: "ko" },
          { count: props.value.no_hash, label: t("Sans hash"), kind: "unknown" },
          { count: props.value.unchecked, label: "?", kind: "unknown" },
          { count: props.value.stale, label: t("Périmé"), kind: "unknown" },
          { count: props.value.unsupported, label: "—", kind: "unknown" },
        ].filter((v) => v.count)
      : [];
  return (
    <span
      class="integrity-status"
      title={
        props.value
          ? t(
              "FLAC MD5 : {0} · Ogg CRC : {1}. ? : non vérifié ; — : format sans contrôle disponible.",
              props.value.md5,
              props.value.crc,
            )
          : t("Mettez à jour puis redémarrez Aède pour afficher l’intégrité.")
      }
    >
      <Show when={props.value} fallback="?">
        <For each={entries()}>
          {(item) => (
            <small class={`integrity-${item.kind}`}>
              {item.label} {item.count}
            </small>
          )}
        </For>
      </Show>
    </span>
  );
}

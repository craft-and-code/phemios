import { Show } from "solid-js";
import { Icon } from "./Icon";
import { ActivityGlyph } from "./ActivityGlyph";
import { t } from "../i18n";
/** A transient album check shares the heading's compact action geometry; no report export. */
export function AlbumIntegrity(props: {
  busy: boolean;
  enabled: boolean;
  cancellable: boolean;
  onStart: () => void;
  onCancel: () => void;
}) {
  return (
    <button
      type="button"
      class="icon-button quiet integrity-action"
      aria-busy={props.busy || undefined}
      aria-label={props.busy ? t("Arrêter le test") : t("Tester l’intégrité de l’album")}
      title={props.busy ? t("Arrêter le test") : t("Tester l’intégrité de l’album")}
      disabled={props.busy ? !props.cancellable : !props.enabled}
      onClick={() => (props.busy ? props.onCancel() : props.onStart())}
    >
      <Show when={props.busy} fallback={<Icon name="integrity" />}>
        <ActivityGlyph cancellable={props.cancellable} />
      </Show>
    </button>
  );
}

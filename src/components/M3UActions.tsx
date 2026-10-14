import { Show } from "solid-js";
import { t } from "../i18n";
import { Icon } from "./Icon";
import { ActivityGlyph } from "./ActivityGlyph";
import { DownloadButton } from "./DownloadButton";
/** Both stable album actions remain visible; existence permits download and prevents redundant publication. */
export function M3UActions(props: {
  available: boolean;
  canCreate: boolean;
  enabled: boolean;
  busy: boolean;
  identity: unknown;
  onCreate: () => void;
  onDownload: () => Promise<boolean>;
}) {
  return (
    <div class="m3u-actions">
      <button
        type="button"
        class="icon-button quiet"
        aria-label={t("Enregistrer le M3U sur Aède")}
        title={t("Enregistrer le M3U sur Aède")}
        disabled={!props.enabled || !props.canCreate || props.available || props.busy}
        onClick={props.onCreate}
      >
        <Show when={props.busy && !props.available} fallback={<Icon name="playlist" />}>
          <ActivityGlyph />
        </Show>
      </button>
      <DownloadButton
        label={t("Télécharger le M3U")}
        identity={props.identity}
        disabled={!props.enabled || !props.available || props.busy}
        onClick={props.onDownload}
      />
    </div>
  );
}

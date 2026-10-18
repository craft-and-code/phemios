import { t } from "../i18n";
import { ActionButton } from "./ActionButton";
/** Connected-server actions expose their own request state. */
export function ConnectionActions(props: {
  syncing: boolean;
  disconnecting: boolean;
  onSync: () => void;
  onDisconnect: () => void;
}) {
  return (
    <div class="settings-actions">
      <ActionButton
        type="button"
        icon="refresh"
        busy={props.syncing}
        disabled={props.disconnecting}
        onClick={props.onSync}
      >
        {props.syncing ? t("Synchronisation…") : t("Recharger le catalogue connu")}
      </ActionButton>
      <ActionButton
        type="button"
        icon="disconnect"
        busy={props.disconnecting}
        onClick={props.onDisconnect}
      >
        {t("Se déconnecter")}
      </ActionButton>
    </div>
  );
}

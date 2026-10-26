import { t } from "../i18n";
import { RefreshButton } from "./RefreshButton";
import { ActionButton } from "./ActionButton";
/** Connected-server actions expose their own request state. */
export function ConnectionActions(props: {
  identity?: unknown;
  syncing: boolean;
  disconnecting: boolean;
  blocked?: boolean;
  onSync: (signal: AbortSignal) => unknown;
  onDisconnect: () => void;
}) {
  return (
    <div class="settings-actions">
      <RefreshButton
        identity={props.identity}
        label={t("Recharger le catalogue connu")}
        busy={props.syncing}
        disabled={props.disconnecting || !!props.blocked}
        onRefresh={(_event, signal) => props.onSync(signal)}
      >
        {props.syncing ? t("Synchronisation…") : t("Recharger le catalogue connu")}
      </RefreshButton>
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

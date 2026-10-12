import { Show } from "solid-js";
import { useLibrary } from "../library/context";
import { t } from "../i18n";
/** Persistent access explanation belongs inside its view, separately from empty results. */
export function AccountNotice(props: { administrator?: boolean; connected?: boolean }) {
  const library = useLibrary();
  const connected = () => props.connected ?? !!library.session();
  return (
    <Show
      when={!connected() || (props.administrator && library.session()?.account.role !== "admin")}
    >
      <p class="notice account-notice">
        {!connected()
          ? t("Connectez-vous pour accéder aux données de votre compte.")
          : t("Un compte administrateur est nécessaire pour lancer les analyses et les spectres.")}
      </p>
    </Show>
  );
}

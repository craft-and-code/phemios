import { Show } from "solid-js";
import { useLibrary } from "../library/context";
import { parentalMessage } from "../library/parental-access";
import { t } from "../i18n";
/** Explain the selected account's server-owned limits without turning the notice into an authority. */
export function ParentalNotice() {
  const library = useLibrary(),
    access = library.parental;
  const remaining = () => access.status()?.remaining_seconds;
  return (
    <Show when={access.supported() && (access.status()?.policy.enabled || access.error())}>
      <p class="notice account-notice" role="status">
        {access.error()
          ? parentalMessage("policy_unavailable")
          : !access.status()?.allowed
            ? parentalMessage(access.status()?.reason ?? null)
            : remaining() == null
              ? t("Compte supervisé · Écoute autorisée.")
              : t(
                  "Compte supervisé · Temps d’écoute restant : {0} min.",
                  Math.ceil(remaining()! / 60),
                )}
      </p>
    </Show>
  );
}

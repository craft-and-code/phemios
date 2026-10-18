import { Show } from "solid-js";
import { t, locale } from "../i18n";
import { ActionButton } from "./ActionButton";
import type { ConcertConfig } from "../concerts/config";
/** Native-free settings presentation; credentials are never populated from retained storage. */
export function JamBaseSettingsView(props: {
  status?: ConcertConfig | undefined;
  key: string;
  busy: boolean;
  native: boolean;
  removable: boolean;
  onKey: (key: string) => void;
  onSave: (remove: boolean) => void;
}) {
  return (
    <section class="jambase-settings">
      <h3>JamBase · {props.status?.ready ? t("configurée") : t("absente")}</h3>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          props.onSave(false);
        }}
      >
        <label>
          {t("Clé API JamBase")}
          <input
            type="password"
            autocomplete="off"
            value={props.key}
            disabled={props.busy}
            onInput={(event) => props.onKey(event.currentTarget.value)}
          />
        </label>
        <div class="settings-actions">
          <ActionButton
            type="submit"
            icon="check"
            busy={props.busy}
            disabled={!props.native || !props.key.trim()}
          >
            {t("Enregistrer")}
          </ActionButton>
          <ActionButton
            type="button"
            icon="trash"
            disabled={!props.removable}
            onClick={() => props.onSave(true)}
          >
            {t("Supprimer la clé")}
          </ActionButton>
        </div>
      </form>
      <Show when={props.status}>
        {(status) => (
          <p class="jambase-budget" role="status">
            {t("Budget Phémios : {0} / {1} requêtes utilisées", status().used, status().limit)}
            <Show when={status().resetAt !== null}>
              {" "}
              ·{" "}
              {t(
                "Prochaine place libérée le {0}",
                new Date((status().resetAt ?? 0) * 1000).toLocaleString(locale()),
              )}
            </Show>
          </p>
        )}
      </Show>
      <p class="muted">
        {t(
          "Plafond de 1 000 recherches sur 32 jours glissants, conservé après redémarrage ou remplacement de la clé. Le quota JamBase est vérifié avant chaque recherche ; son contrôle ne consomme pas le quota. Le compteur inclut l’usage JamBase déjà constaté.",
        )}
      </p>
      <p class="muted">
        {t(
          "Réservez votre compte JamBase à cette installation de Phémios : les autres applications et appareils partagent son quota et peuvent entraîner des frais JamBase.",
        )}
      </p>
      <p class="muted">
        {t(
          "La clé reste sur cet appareil. Aucun compte Aède n’est nécessaire. Offre Developer : usage non commercial, concerts à venir sur six mois.",
        )}{" "}
        <a href="https://data.jambase.com/try/">{t("Obtenir une clé")}</a>
      </p>
    </section>
  );
}

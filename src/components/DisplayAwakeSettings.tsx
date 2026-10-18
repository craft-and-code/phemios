import { t } from "../i18n";
import { Feedback } from "./Feedback";
/** One account-scoped switch covers every source; runtime failure never pauses audio. */
export function DisplayAwakeSettings(props: {
  enabled: boolean;
  disabled?: boolean;
  error: string;
  onChange: (enabled: boolean) => void;
}) {
  return (
    <section class="settings-card">
      <h2>{t("Économiseur d’écran")}</h2>
      <label class="check">
        <input
          type="checkbox"
          checked={props.enabled}
          disabled={props.disabled}
          onChange={(event) => props.onChange(event.currentTarget.checked)}
        />
        <span>{t("Garder l’écran actif pendant la lecture")}</span>
      </label>
      <p class="muted">
        {t(
          "Musique, CD audio, radios et podcasts. L’économiseur est rétabli à la pause, à l’arrêt et à la fermeture de Phémios.",
        )}
      </p>
      <Feedback error persistent message={props.error} />
    </section>
  );
}

import { t } from "../i18n";
import { Icon } from "./Icon";
/** Role help reflects server permissions; administrative routes additionally require local HTTP. */
export function RoleHelp() {
  return (
    <details class="role-help">
      <summary
        aria-label={t("Comprendre les rôles des comptes")}
        title={t("Comprendre les rôles des comptes")}
      >
        <Icon name="help" />
      </summary>
      <div class="role-description">
        <p>
          <strong>{t("Administrateur")}</strong> —{" "}
          {t(
            "Gère les comptes, les scans et les tâches de la bibliothèque, ainsi que ses données personnelles.",
          )}
        </p>
        <p>
          <strong>{t("Utilisateur")}</strong> —{" "}
          {t("Consulte et écoute la bibliothèque ; gère ses favoris, notes, tags et collections.")}
        </p>
        <p>
          <strong>{t("Auditeur")}</strong> —{" "}
          {t("Consulte et écoute la bibliothèque, sans modifier les données.")}
        </p>
      </div>
    </details>
  );
}

import { t } from "../i18n";
import { Icon } from "./Icon";
/** A reversible album-only catalog filter; release years do not imply recent additions. */
export function RecentAlbumsFilter(props: { active: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      class="icon-button"
      aria-pressed={props.active}
      aria-label={t("Ajoutés ces 30 derniers jours")}
      title={t("Ajoutés ces 30 derniers jours")}
      onClick={props.onToggle}
    >
      <Icon name="sparkles" />
    </button>
  );
}

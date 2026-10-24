import { t } from "../i18n";
import type { Section } from "../navigation/routes";
import { searchContext } from "../navigation/search-context";
import { Icon } from "./Icon";
/** One header search keeps the advanced link and explicit view-dependent search wording. */
export function CatalogSearch(props: {
  section?: Section | undefined;
  value: string;
  onInput: (value: string) => void;
}) {
  const context = () => searchContext(props.section);
  return (
    <div class="search">
      <a
        class="advanced-search-action"
        href="#/advanced-search"
        title={t("Recherche avancée")}
        aria-label={t("Recherche avancée")}
      >
        <Icon name="search" />
        <span>{t("Avancée")}</span>
      </a>
      <input
        type="search"
        disabled={context().disabled}
        aria-label={context().label}
        placeholder={context().placeholder}
        value={context().disabled ? "" : props.value}
        onInput={(event) => props.onInput(event.currentTarget.value)}
      />
    </div>
  );
}

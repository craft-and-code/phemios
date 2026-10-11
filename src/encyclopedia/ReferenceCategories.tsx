import { For } from "solid-js";
import { t, locale } from "../i18n";
import { Icon } from "../components/Icon";
import { encyclopediaRows } from "./catalog";
/** Flat category navigation replaces boxed filter buttons; ordinary keyboard buttons remain accessible. */
export function ReferenceCategories(props: {
  query: string;
  selected: string;
  onSelect: (category: string) => void;
}) {
  return (
    <nav class="reference-categories" aria-label={t("Rubriques de l’encyclopédie")}>
      <For
        each={[
          { id: "", label: "Tous", icon: "book" },
          { id: "history", label: "Histoire", icon: "history" },
          { id: "glossary", label: "Lexique", icon: "alphabet" },
          { id: "analysis", label: "Comprendre les analyses", icon: "wave" },
          { id: "sources", label: "Sources et API", icon: "globe" },
        ]}
      >
        {(category) => (
          <button
            class="reference-category"
            aria-pressed={props.selected === category.id}
            onClick={() => props.onSelect(category.id)}
          >
            <Icon name={category.icon} />
            <span>{t(category.label)}</span>
            <small>{encyclopediaRows(props.query, category.id, locale()).length}</small>
          </button>
        )}
      </For>
    </nav>
  );
}

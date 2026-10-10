import { createMemo, createSignal, For, Show } from "solid-js";
import { t, locale } from "../i18n";
import { encyclopediaRows } from "../encyclopedia/catalog";
import { EmptyState } from "../components/EmptyState";
/** Curated bilingual reference material stays available without an Aède account. */
export function EncyclopediaPage(props: { query: string }) {
  const [category, setCategory] = createSignal("");
  const rows = createMemo(() => encyclopediaRows(props.query, category(), locale()));
  return (
    <section class="page encyclopedia-page">
      <div class="choices">
        <For
          each={[
            ["", "Tous"],
            ["history", "Histoire"],
            ["glossary", "Lexique"],
            ["analysis", "Comprendre les analyses"],
            ["sources", "Sources et API"],
          ]}
        >
          {([id, title]) => (
            <button aria-pressed={category() === id} onClick={() => setCategory(id!)}>
              {t(title!)}
            </button>
          )}
        </For>
      </div>
      <Show
        when={rows().length}
        fallback={<EmptyState icon="book">{t("Aucun article dans cette sélection.")}</EmptyState>}
      >
        <div class="encyclopedia-grid">
          <For each={rows()}>
            {(row) => (
              <article class="settings-card">
                <h2>{row.title[locale()]}</h2>
                <p>{row.body[locale()]}</p>
                <a href={row.source.url} target="_blank" rel="noreferrer">
                  {row.source.title}
                </a>
              </article>
            )}
          </For>
        </div>
      </Show>
    </section>
  );
}

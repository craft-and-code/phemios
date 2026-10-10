import { createMemo, createSignal, createEffect, on, For, Show } from "solid-js";
import { t, locale, type Language } from "../i18n";
import { encyclopediaRows } from "../encyclopedia/catalog";
import { WikipediaPanel } from "../encyclopedia/WikipediaPanel";
import { EmptyState } from "../components/EmptyState";
/** Curated bilingual reference material stays available without an Aède account. */
export function EncyclopediaPage(props: { query: string }) {
  const [mode, setMode] = createSignal<"reference" | "search" | "saved">("reference");
  const [language, setLanguage] = createSignal<Language>(locale());
  createEffect(on(locale, setLanguage));
  const [category, setCategory] = createSignal("");
  const rows = createMemo(() => encyclopediaRows(props.query, category(), locale()));
  return (
    <section class="page encyclopedia-page">
      <div class="choices encyclopedia-tabs">
        <button aria-pressed={mode() === "reference"} onClick={() => setMode("reference")}>
          {t("Fiches de référence")}
        </button>
        <button aria-pressed={mode() === "search"} onClick={() => setMode("search")}>
          {t("Wikipédia")}
        </button>
        <button aria-pressed={mode() === "saved"} onClick={() => setMode("saved")}>
          {t("Articles enregistrés")}
        </button>
        <Show when={mode() !== "reference"}>
          <div
            class="choices wikipedia-language"
            role="group"
            aria-label={t("Langue des articles")}
          >
            <button
              aria-pressed={language() === "fr"}
              aria-label={t("Articles en français")}
              onClick={() => setLanguage("fr")}
            >
              FR
            </button>
            <button
              aria-pressed={language() === "en"}
              aria-label={t("Articles en anglais")}
              onClick={() => setLanguage("en")}
            >
              EN
            </button>
          </div>
        </Show>
      </div>
      <Show
        when={mode() === "reference"}
        fallback={
          <WikipediaPanel
            query={props.query}
            language={language()}
            mode={mode() === "saved" ? "saved" : "search"}
          />
        }
      >
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
      </Show>
    </section>
  );
}

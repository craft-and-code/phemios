import { useViewSession } from "../navigation/ViewSession";
import { StickyHeader } from "../components/StickyHeader";
import { Icon } from "../components/Icon";
import { ReferenceCategories } from "../encyclopedia/ReferenceCategories";
import { createMemo, createSignal, For, Show } from "solid-js";
import { t, locale } from "../i18n";
import { encyclopediaRows } from "../encyclopedia/catalog";
import { WikipediaPanel } from "../encyclopedia/WikipediaPanel";
import { EmptyState } from "../components/EmptyState";
/** Curated bilingual reference material stays available without an Aède account. */
export function EncyclopediaPage(props: { query: string }) {
  const [mode, setMode] = useViewSession().control("encyclopediaMode");
  const [editionBusy, setEditionBusy] = createSignal(false);
  const [language, setLanguage] = useViewSession().control("encyclopediaLanguage");
  const [category, setCategory] = useViewSession().control("encyclopediaCategory");
  const rows = createMemo(() => encyclopediaRows(props.query, category(), locale()));
  return (
    <section class="page result-page encyclopedia-page">
      <StickyHeader>
        <div class="choices encyclopedia-tabs">
          <button aria-pressed={mode() === "reference"} onClick={() => setMode("reference")}>
            {t("Fiches de référence")}
          </button>
          <button aria-pressed={mode() === "search"} onClick={() => setMode("search")}>
            {t("Wikipédia")}
          </button>
          <button aria-pressed={mode() === "saved"} onClick={() => setMode("saved")}>
            <Icon name="heart" />
            {t("Articles enregistrés")}
          </button>
          <Show when={mode() !== "reference"}>
            <button
              class="edition-switch"
              type="button"
              role="switch"
              disabled={editionBusy()}
              aria-checked={language() === "en"}
              aria-label={t("Articles en anglais")}
              title={t("Langue des articles")}
              onClick={() => setLanguage(language() === "fr" ? "en" : "fr")}
              onKeyDown={(event) => {
                if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
                  event.preventDefault();
                  setLanguage(event.key === "ArrowLeft" ? "fr" : "en");
                }
              }}
            >
              <span aria-hidden="true">FR</span>
              <span aria-hidden="true">EN</span>
            </button>
          </Show>
        </div>
      </StickyHeader>
      <Show
        when={mode() === "reference"}
        fallback={
          <WikipediaPanel
            query={props.query}
            language={language()}
            onLanguageUnavailable={setLanguage}
            onBusy={setEditionBusy}
            mode={mode() === "saved" ? "saved" : "search"}
          />
        }
      >
        <div class="reference-workspace">
          <ReferenceCategories query={props.query} selected={category()} onSelect={setCategory} />
          <div class="reference-content">
            <Show
              when={rows().length}
              fallback={
                <EmptyState icon="book">{t("Aucun article dans cette sélection.")}</EmptyState>
              }
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
          </div>
        </div>
      </Show>
    </section>
  );
}

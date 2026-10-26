import { InlineActionForm } from "../components/InlineActionForm";
import { AccountNotice } from "../components/AccountNotice";
import { useLibrary } from "../library/context";
import { createAccountSavedArticles } from "./account-saved";
import { PageLoader } from "../components/PageLoader";
import { createEffect, createMemo, createSignal, For, on, onCleanup, Show } from "solid-js";
import { t, locale, type Language } from "../i18n";
import {
  searchEncyclopedia,
  readEncyclopedia,
  translateEncyclopedia,
  downloadEncyclopedia,
  isNative,
  readArticleState,
  updateArticleState,
} from "../platform/desktop";
import { ActionButton } from "../components/ActionButton";
import { EmptyState } from "../components/EmptyState";
import { Feedback } from "../components/Feedback";
import { Icon } from "../components/Icon";
import { createWikipediaExplorer } from "./explore";
import { WikipediaReader } from "./WikipediaReader";
/** Public exploration is explicit and account-independent; saved reading performs no request. */
export function WikipediaPanel(props: {
  query: string;
  mode: "search" | "saved";
  language: Language;
  onLanguageUnavailable: (language: Language) => void;
  onBusy: (busy: boolean) => void;
}) {
  const library = useLibrary();
  const saved = createAccountSavedArticles(library.session, library.source, {
    read: readArticleState,
    update: updateArticleState,
  });
  const [term, setTerm] = createSignal(props.query);
  const language = () => props.language;
  const state = createWikipediaExplorer(
    {
      search: searchEncyclopedia,
      read: readEncyclopedia,
      translate: translateEncyclopedia,
      download: downloadEncyclopedia,
    },
    language,
    saved,
  );
  let alive = true;
  createEffect(
    on(
      language,
      () => {
        void state.changeEdition(term()).then((changed) => {
          const article = state.article();
          if (alive && !changed && article) props.onLanguageUnavailable(article.language);
        });
      },
      { defer: true },
    ),
  );
  createEffect(() => props.onBusy(!!state.busy() || saved.pending()));
  createEffect(() => {
    library.session();
    library.source();
    state.reset();
  });
  createEffect(on(() => props.mode, state.back));
  onCleanup(() => {
    alive = false;
    state.dispose();
    props.onBusy(false);
  });
  const savedRows = createMemo(() => {
    const needle = props.query.trim().toLocaleLowerCase(locale());
    return state.saved
      .rows()
      .filter(
        (row) =>
          row.language === language() &&
          `${row.title} ${row.text}`.toLocaleLowerCase(locale()).includes(needle),
      );
  });
  return (
    <section class="wikipedia-panel" aria-label={t("Articles Wikipédia")}>
      <Show when={props.mode === "saved"}>
        <AccountNotice connected={saved.available()} />
      </Show>
      <Show when={state.saved.error()}>
        <p class="error" role="alert">
          {state.saved.error()}
        </p>
      </Show>
      <Feedback message={state.error()} error />
      <Feedback message={state.notice()} />
      <Show
        when={state.article()}
        fallback={
          <>
            <Show when={props.mode === "search"}>
              <InlineActionForm
                class="wikipedia-search"
                onSubmit={(event) => {
                  event.preventDefault();
                  void state.search(term());
                }}
              >
                <label>
                  {t("Recherche Wikipédia")}
                  <input
                    value={term()}
                    maxlength={200}
                    placeholder={t("Artiste, genre, histoire ou technique audio…")}
                    onInput={(event) => setTerm(event.currentTarget.value)}
                    disabled={!!state.busy()}
                  />
                </label>
                <ActionButton
                  type="submit"
                  icon="search"
                  busy={state.busy() === "search"}
                  disabled={!isNative() || !!state.busy() || !term().trim()}
                >
                  {t("Rechercher")}
                </ActionButton>
              </InlineActionForm>
              <Show when={!isNative()}>
                <p class="subtle">
                  {t(
                    "La recherche Wikipédia nécessite l’application desktop. Les fiches et copies locales restent consultables.",
                  )}
                </p>
              </Show>
              <Show when={state.searched()}>
                <p class="subtle">
                  {t("{0} résultat(s) · 20 premiers résultats au maximum", state.hits().length)}
                </p>
                <Show
                  when={state.hits().length}
                  fallback={
                    <EmptyState icon="book">{t("Aucun article dans cette sélection.")}</EmptyState>
                  }
                >
                  <div class="wikipedia-results">
                    <For each={state.hits()}>
                      {(hit) => (
                        <button
                          class="wikipedia-result"
                          disabled={!!state.busy()}
                          onClick={() => void state.open(hit)}
                        >
                          <Icon name="book" />
                          <span>{hit.title}</span>
                          <Icon name="chevron-right" />
                        </button>
                      )}
                    </For>
                  </div>
                </Show>
              </Show>
            </Show>
            <Show when={props.mode === "saved"}>
              <Show
                when={savedRows().length}
                fallback={
                  <Show when={!saved.loading()} fallback={<PageLoader inline />}>
                    <EmptyState icon="heart">
                      {t("Aucun article enregistré dans cette sélection.")}
                    </EmptyState>
                  </Show>
                }
              >
                <div class="wikipedia-results">
                  <For each={savedRows()}>
                    {(row) => (
                      <div class="wikipedia-saved-row">
                        <button class="wikipedia-result" onClick={() => void state.open(row)}>
                          <Icon name="heart" />
                          <span>{row.title}</span>
                          <Icon name="chevron-right" />
                        </button>
                        <button
                          class="icon-button quiet"
                          aria-label={t("Retirer la copie locale")}
                          title={t("Retirer la copie locale")}
                          disabled={!saved.writable() || !!state.busy()}
                          onClick={() => void state.saved.remove(row)}
                        >
                          <Icon name="trash" />
                        </button>
                      </div>
                    )}
                  </For>
                </div>
              </Show>
            </Show>
            <Show when={state.busy() === "article"}>
              <p class="loading" role="status">
                <span class="spinner" />
                {t("Chargement de l’article…")}
              </p>
            </Show>
          </>
        }
      >
        {(article) => (
          <WikipediaReader
            identity={library.session()}
            article={article()}
            retained={state.retained()}
            busy={!!state.busy() || saved.pending()}
            writable={saved.writable()}
            saving={saved.pending()}
            loading={state.busy() === "article"}
            downloading={state.busy() === "download"}
            native={isNative()}
            onBack={state.back}
            onSave={() => void state.save()}
            onDownload={state.download}
            onCancel={state.cancel}
            onRefresh={() => state.open(article(), true)}
            onRemove={() => void state.saved.remove(article())}
          />
        )}
      </Show>
    </section>
  );
}

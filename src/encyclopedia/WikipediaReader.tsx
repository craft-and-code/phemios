import { Icon } from "../components/Icon";
import { For, Show } from "solid-js";
import { t, locale } from "../i18n";
import { ActionButton } from "../components/ActionButton";
import { wikipediaBlocks, wikipediaLinks, type WikipediaArticle } from "./wikipedia";
/** Plain-text reading retains revision, author history and licence even when offline. */
export function WikipediaReader(props: {
  article: WikipediaArticle;
  retained: boolean;
  busy: boolean;
  native: boolean;
  onBack: () => void;
  onSave: () => void;
  onRefresh: () => void;
  onRemove: () => void;
}) {
  const links = () => wikipediaLinks(props.article);
  return (
    <article class="settings-card wikipedia-reader">
      <div class="wikipedia-reader-actions">
        <ActionButton icon="back" onClick={props.onBack}>
          {t("Retour aux articles")}
        </ActionButton>
        <span class="wikipedia-reader-status">
          {t("Wikipédia")} · {props.article.language.toUpperCase()}
          <Show when={props.retained}> · {t("Disponible hors connexion")}</Show>
        </span>
        <div class="wikipedia-reader-tools">
          <button
            class="icon-button quiet"
            disabled={props.busy || !props.native}
            aria-label={t("Actualiser l’article depuis Wikipédia")}
            title={t("Actualiser l’article depuis Wikipédia")}
            onClick={props.onRefresh}
          >
            <Show when={props.busy} fallback={<Icon name="refresh" />}>
              <span class="spinner" />
            </Show>
          </button>
          <button
            class="icon-button quiet"
            disabled={props.retained || props.busy}
            aria-label={t("Enregistrer pour lire hors connexion")}
            title={t("Enregistrer pour lire hors connexion")}
            onClick={props.onSave}
          >
            <Icon name="download" />
          </button>
          <Show when={props.retained}>
            <button
              class="icon-button quiet"
              aria-label={t("Retirer la copie locale")}
              title={t("Retirer la copie locale")}
              onClick={props.onRemove}
            >
              <Icon name="trash" />
            </button>
          </Show>
        </div>
      </div>
      <h2>{props.article.title}</h2>
      <div class="wikipedia-attribution">
        <a href={links().article} target="_blank" rel="noreferrer">
          {t("Article original")}
        </a>
        <a href={links().authors} target="_blank" rel="noreferrer">
          {t("Auteurs et historique")}
        </a>
        <a href={links().revision} target="_blank" rel="noreferrer">
          {t("Révision {0}", props.article.revision)}
        </a>
        <a href={links().license} target="_blank" rel="noreferrer">
          CC BY-SA 4.0
        </a>
        <span>
          {t("Consulté le {0}", new Date(props.article.retrievedAt).toLocaleDateString(locale()))}
        </span>
      </div>
      <p class="wikipedia-extract-note">
        {t(
          "Texte extrait par Wikipédia, sans images ni tableaux. Consultez l’original pour ses références et sa mise en page complète.",
        )}
      </p>
      <div class="wikipedia-prose">
        <For each={wikipediaBlocks(props.article.text)}>
          {(block) => (
            <Show when={block.heading} fallback={<p>{block.text}</p>}>
              <h3>{block.text}</h3>
            </Show>
          )}
        </For>
      </div>
    </article>
  );
}

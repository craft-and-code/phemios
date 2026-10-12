import { DownloadButton } from "../components/DownloadButton";
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
  loading: boolean;
  downloading: boolean;
  native: boolean;
  writable: boolean;
  saving: boolean;
  onBack: () => void;
  onSave: () => void;
  onDownload: () => Promise<boolean>;
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
            <Show when={props.loading} fallback={<Icon name="refresh" />}>
              <span class="spinner" />
            </Show>
          </button>
          <button
            class="icon-button quiet"
            disabled={props.busy || !props.writable}
            aria-pressed={props.retained}
            aria-label={
              props.retained
                ? t("Retirer la copie locale")
                : t("Enregistrer pour lire hors connexion")
            }
            title={
              props.retained
                ? t("Retirer la copie locale")
                : t("Enregistrer pour lire hors connexion")
            }
            onClick={() => (props.retained ? props.onRemove() : props.onSave())}
          >
            <Show when={props.saving} fallback={<Icon name="heart" />}>
              <span class="spinner" />
            </Show>
          </button>
          <DownloadButton
            label={t("Télécharger l’article sur cet ordinateur")}
            identity={props.article}
            disabled={!props.native || (props.busy && !props.downloading)}
            busy={props.downloading}
            onClick={props.onDownload}
          />
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

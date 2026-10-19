import { linkResourceBlocks } from "../encyclopedia/resource-links";
import { WikipediaResourceText, WikipediaUnmatchedResources } from "./WikipediaResourceText";
import { Icon } from "./Icon";
import { ActivityGlyph } from "./ActivityGlyph";
import { DownloadButton } from "./DownloadButton";
import { createEffect, createMemo, createSignal, on, For, Show, type JSX } from "solid-js";
import { t, locale } from "../i18n";
import { ScrollToTop } from "./ScrollToTop";
import { Feedback } from "./Feedback";
import { wikipediaBlocks, wikipediaLinks, type WikipediaArticle } from "../encyclopedia/wikipedia";
import { readingTypography } from "../library/biography-reading";
/** Literal-text reading keeps private saves and file downloads as separate controlled actions. */
export function ArtistBiography(props: {
  article: WikipediaArticle;
  renderText?: (text: string) => JSX.Element;
  artist: string;
  photos: readonly string[];
  error?: string;
  onDismissError?: () => void;
  onSave?: ((article: WikipediaArticle) => void) | undefined;
  saved?: boolean;
  saving?: boolean;
  saveDisabled?: boolean;
  saveUnavailable?: string | undefined;
  saveError?: string;
  onDownload?: ((article: WikipediaArticle) => Promise<unknown>) | undefined;
}) {
  let reader!: HTMLElement;
  const [downloadError, setDownloadError] = createSignal("");
  createEffect(
    on(
      () => props.article,
      () => setDownloadError(""),
    ),
  );
  const links = () => wikipediaLinks(props.article);
  const reading = createMemo(() =>
    linkResourceBlocks(
      wikipediaBlocks(readingTypography(props.article.text, props.article.language)),
      props.article.externalLinks,
    ),
  );
  const blocks = () => reading().blocks;
  const headings: (HTMLHeadingElement | undefined)[] = [];
  const sections = createMemo(() =>
    blocks().flatMap((block, index) => (block.heading ? [{ text: block.text, index }] : [])),
  );
  return (
    <article
      ref={(element) => {
        reader = element;
      }}
      class="artist-biography-reader"
    >
      <p class="eyebrow">{t("BIOGRAPHIE")}</p>
      <div class="biography-reader-heading">
        <h1 tabindex="-1">{props.article.title}</h1>
        <div class="biography-reader-tools">
          <button
            type="button"
            class="icon-button quiet biography-save"
            aria-label={t(
              props.saved ? "Disponible hors connexion" : "Enregistrer pour lire hors connexion",
            )}
            title={
              props.saved
                ? t("Disponible hors connexion")
                : props.saveUnavailable || t("Enregistrer pour lire hors connexion")
            }
            aria-pressed={!!props.saved}
            aria-busy={!!props.saving}
            disabled={!props.onSave || props.saveDisabled || props.saving || props.saved}
            onClick={() => props.onSave?.(props.article)}
          >
            <Show when={props.saving} fallback={<Icon name="heart" />}>
              <ActivityGlyph />
            </Show>
          </button>
          <DownloadButton
            label={t("Télécharger la biographie complète")}
            identity={props.article}
            disabled={!props.onDownload}
            onClick={() => {
              setDownloadError("");
              return props.onDownload?.(props.article);
            }}
            onError={(failure) =>
              setDownloadError(failure instanceof Error ? failure.message : String(failure))
            }
          />
        </div>
      </div>
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
      <p class="muted">
        {t(
          "Texte extrait par Wikipédia, sans images ni tableaux. Consultez l’original pour ses références et sa mise en page complète.",
        )}
      </p>
      <Feedback error message={props.error ?? ""} onClose={() => props.onDismissError?.()} />
      <Feedback error message={props.saveError ?? ""} />
      <Feedback error message={downloadError()} onClose={() => setDownloadError("")} />
      <Show when={sections().length > 1}>
        <nav class="biography-toc" aria-label={t("Sommaire")}>
          <h2>{t("Sommaire")}</h2>
          <ol>
            <For each={sections()}>
              {(section) => (
                <li>
                  <button
                    type="button"
                    class="metadata-link"
                    onClick={() => {
                      const heading = headings[section.index];
                      heading?.scrollIntoView({ block: "start", behavior: "smooth" });
                      heading?.focus({ preventScroll: true });
                    }}
                  >
                    {readingTypography(section.text, props.article.language)}
                  </button>
                </li>
              )}
            </For>
          </ol>
        </nav>
      </Show>
      <Show when={props.photos[0]}>
        {(url) => (
          <figure class="biography-photo">
            <img src={url()} alt={props.artist} />
            <figcaption>{t("Image du catalogue Aède")}</figcaption>
          </figure>
        )}
      </Show>
      <div class="wikipedia-prose">
        <For each={blocks()}>
          {(block, index) => (
            <>
              <Show
                when={block.heading}
                fallback={
                  <p>
                    <WikipediaResourceText parts={block.parts} renderText={props.renderText} />
                  </p>
                }
              >
                <h2
                  ref={(element) => {
                    headings[index()] = element;
                  }}
                  tabindex="-1"
                >
                  {readingTypography(block.text, props.article.language)}
                </h2>
              </Show>
              <For each={props.photos.slice(1)}>
                {(url, photo) => (
                  <Show
                    when={
                      index() ===
                      Math.floor(((photo() + 1) * blocks().length) / props.photos.length)
                    }
                  >
                    <figure class="biography-photo">
                      <img src={url} alt={props.artist} loading="lazy" />
                      <figcaption>{t("Image du catalogue Aède")}</figcaption>
                    </figure>
                  </Show>
                )}
              </For>
            </>
          )}
        </For>
      </div>
      <WikipediaUnmatchedResources links={reading().unmatched} />
      <ScrollToTop target={() => reader} />
    </article>
  );
}

import { createMemo, createResource, createSignal, For, Show } from "solid-js";
import { t } from "../i18n";
import { useLibrary } from "../library/context";
import { requestAede } from "../platform/desktop";
import { advancedExpression, blankSearch, type SearchCriteria } from "../library/advanced-search";
import { combinedTrackReader } from "../library/combined-tracks";
import { TrackResults } from "../components/TrackResults";
import { SelectionCollection } from "../components/SelectionCollection";
import { StarRating } from "../components/StarRating";
import { Feedback } from "../components/Feedback";
import { EmptyState } from "../components/EmptyState";
import { Icon } from "../components/Icon";
/** Explicit submissions share Aède's owner-private evaluator and bounded catalog paging. */
export function AdvancedSearchPage() {
  const library = useLibrary(),
    [criteria, setCriteria] = createSignal(blankSearch()),
    [submitted, setSubmitted] = createSignal<{ expression: string }>(),
    [offset, setOffset] = createSignal(0),
    [error, setError] = createSignal("");
  const text = (field: string, value: string) =>
    setCriteria((old) => ({ ...old, text: { ...old.text, [field]: value } }));
  const bound = (field: string, index: number, value: string) =>
    setCriteria((old) => {
      const bounds: [string, string] = [...(old.ranges[field] ?? ["", ""])];
      bounds[index] = value;
      return { ...old, ranges: { ...old.ranges, [field]: bounds } };
    });
  function submit() {
    try {
      setSubmitted({ expression: advancedExpression(criteria()) });
      setOffset(0);
      setError("");
    } catch (failure) {
      setError(String(failure));
    }
  }
  const reader = createMemo(() => {
    const saved = submitted(),
      sources = library.trackSources();
    if (!saved || !sources.length) return;
    return combinedTrackReader(sources, async (source, at) => {
      const status = await requestAede<{ capabilities: string[] }>(
        "/api/v1/status",
        {},
        "GET",
        null,
        source,
      );
      if (!status.capabilities?.includes("advanced_search"))
        throw new Error(t("Mettez à jour puis redémarrez Aède pour la recherche avancée."));
      return requestAede(
        "/api/me/v1/search",
        { expression: saved.expression, offset: String(at), limit: "50" },
        "GET",
        null,
        source,
      );
    });
  });
  const [results] = createResource(
    () => reader() && { read: reader()!, offset: offset() },
    (key) => key.read(key.offset),
  );
  const field = (id: string, label: string) => (
    <label>
      {t(label)}
      <input value={criteria().text[id] ?? ""} onInput={(e) => text(id, e.currentTarget.value)} />
    </label>
  );
  const range = (id: string, label: string) => (
    <label>
      {t(label)}
      <span class="search-range">
        <input
          type="number"
          min="0"
          step="any"
          aria-label={t("{0} · minimum", t(label))}
          placeholder={t("Min")}
          value={criteria().ranges[id]?.[0] ?? ""}
          onInput={(e) => bound(id, 0, e.currentTarget.value)}
        />
        <span>—</span>
        <input
          type="number"
          min="0"
          step="any"
          aria-label={t("{0} · maximum", t(label))}
          placeholder={t("Max")}
          value={criteria().ranges[id]?.[1] ?? ""}
          onInput={(e) => bound(id, 1, e.currentTarget.value)}
        />
      </span>
    </label>
  );
  const flag = (id: "favourite" | "lossless" | "compilation", label: string) => (
    <div>
      <span class="search-field-label">{t(label)}</span>
      <div class="choices">
        <For
          each={
            [
              ["", "Tous"],
              ["true", "Oui"],
              ["false", "Non"],
            ] as const
          }
        >
          {([value, caption]) => (
            <button
              type="button"
              aria-pressed={criteria()[id] === value}
              onClick={() => setCriteria((old) => ({ ...old, [id]: value }))}
            >
              {t(caption)}
            </button>
          )}
        </For>
      </div>
    </div>
  );
  return (
    <section class="page advanced-search-page" aria-label={t("Recherche avancée")}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <div class="advanced-search-fields">
          <fieldset class="settings-card">
            <legend>{t("Catalogue")}</legend>
            <div class="settings-field-grid">
              {field("title", "Titre")}
              {field("artist", "Artiste")}
              {field("album", "Album")}
              {field("albumartist", "Artiste d’album")}
              {range("year", "Année")}
              {field("genre", "Genre")}
              {field("label", "Label")}
              {field("work", "Œuvre")}
              {field("composer", "Compositeur")}
              {field("performer", "Interprète")}
              {field("instrument", "Instrument")}
              {field("comment", "Commentaire du fichier")}
              {flag("compilation", "Compilation")}
            </div>
          </fieldset>
          <fieldset class="settings-card">
            <legend>{t("Fichiers audio")}</legend>
            <div class="choices formats">
              <For each={["flac", "wav", "aiff", "mp3", "mp4", "ogg", "wv", "ape"]}>
                {(format) => (
                  <button
                    type="button"
                    aria-pressed={criteria().formats.includes(format)}
                    onClick={() =>
                      setCriteria((old) => ({
                        ...old,
                        formats: old.formats.includes(format)
                          ? old.formats.filter((v) => v !== format)
                          : [...old.formats, format],
                      }))
                    }
                  >
                    {format.toUpperCase()}
                  </button>
                )}
              </For>
            </div>
            <div class="settings-field-grid">
              {range("samplerate", "Fréquence · Hz")}
              {range("bitdepth", "Profondeur · bits")}
              {range("channels", "Canaux")}
              {range("bitrate", "Débit · kb/s")}
              {range("duration", "Durée · secondes")}
              {range("size", "Taille · Mio")}
              {field("path", "Chemin du fichier")}
              {flag("lossless", "Sans perte")}
            </div>
          </fieldset>
          <fieldset class="settings-card">
            <legend>{t("Vos annotations")}</legend>
            <div class="choices annotation-scope">
              <For
                each={
                  [
                    ["any", "Tous les niveaux"],
                    ["artist", "Artiste"],
                    ["album", "Album"],
                    ["track", "Piste"],
                  ] as const
                }
              >
                {([value, caption]) => (
                  <button
                    type="button"
                    aria-pressed={criteria().scope === value}
                    onClick={() =>
                      setCriteria((old) => ({ ...old, scope: value as SearchCriteria["scope"] }))
                    }
                  >
                    {t(caption)}
                  </button>
                )}
              </For>
            </div>
            <div class="settings-field-grid">
              <div>
                <span class="search-field-label">{t("Note minimale")}</span>
                <StarRating
                  value={Number(criteria().ranges.rating?.[0]) || null}
                  label={t("Note minimale")}
                  onChange={(value) => bound("rating", 0, value ? String(value) : "")}
                />
              </div>
              <div>
                <span class="search-field-label">{t("Note maximale")}</span>
                <StarRating
                  value={Number(criteria().ranges.rating?.[1]) || null}
                  label={t("Note maximale")}
                  onChange={(value) => bound("rating", 1, value ? String(value) : "")}
                />
              </div>
              {field("tag", "Tags · séparés par des virgules")}
              {field("note", "Note personnelle")}
              {range("played", "Nombre d’écoutes")}
              {flag("favourite", "Favoris")}
            </div>
          </fieldset>
        </div>
        <div class="advanced-search-actions">
          <button
            type="button"
            onClick={() => {
              setCriteria(blankSearch());
              setSubmitted(undefined);
              setError("");
            }}
          >
            {t("Réinitialiser")}
          </button>
          <button class="primary" disabled={!library.trackSources().length || results.loading}>
            <Show when={results.loading} fallback={<Icon name="search" />}>
              <span class="spinner" />
            </Show>
            {t("Rechercher")}
          </button>
        </div>
      </form>
      <Feedback error message={error()} onClose={() => setError("")} />
      <Show when={!library.trackSources().length}>
        <Feedback message={t("Connectez Aède pour consulter toutes les pistes.")} />
      </Show>
      <Show when={results.error}>
        <Feedback error message={String(results.error)} />
      </Show>
      <Show when={submitted() && results() && !results.loading}>
        {(_value) => (
          <>
            <div class="section-heading">
              <p>{t("{0} résultats", results()!.total)}</p>
              <div class="page-controls">
                <button
                  class="icon-button"
                  aria-label={t("Précédent")}
                  disabled={!offset()}
                  onClick={() => setOffset(Math.max(0, offset() - 50))}
                >
                  <Icon name="back" />
                </button>
                <button
                  class="icon-button"
                  aria-label={t("Suivant")}
                  disabled={offset() + 50 >= results()!.total}
                  onClick={() => setOffset(offset() + 50)}
                >
                  <Icon name="next" />
                </button>
              </div>
              <SelectionCollection
                expression={submitted()!.expression}
                disabled={!results()!.total}
              />
            </div>
            <For each={results()!.unavailable}>
              {(issue) => <Feedback error message={issue.error} />}
            </For>
            <Show when={!results()!.items.length}>
              <EmptyState icon="search">{t("Aucune piste dans cette recherche.")}</EmptyState>
            </Show>
            <ol class="track-list">
              <For each={results()!.items}>
                {(track, index) => (
                  <TrackResults
                    track={track}
                    number={offset() + index() + 1}
                    origin
                    onPlay={() => void library.player.startReference(track.reference)}
                    context={<small>{track.album_title ?? t("Sans album")}</small>}
                  />
                )}
              </For>
            </ol>
          </>
        )}
      </Show>
    </section>
  );
}

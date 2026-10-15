import { EmptyState } from "../components/EmptyState";
import { locale } from "../i18n";
import { t } from "../i18n";
import { createMemo, createSignal, For, Show } from "solid-js";
import { useLibrary } from "../library/context";
import { searchArtist } from "../library/filtering";
import { AlbumGrid } from "../components/AlbumGrid";
import { RelationGraph } from "../components/RelationGraph";
import { neighbours } from "../library/relations";
/** A bounded, keyboard-accessible view of Aède's actual local collaborations. */
export function RelationsPage(props: { query: string; compact: boolean }) {
  const library = useLibrary(),
    [reference, setReference] = createSignal(""),
    [search, setSearch] = createSignal(""),
    [mode, setMode] = createSignal<"artist" | "album">("artist");
  const choices = createMemo(() =>
    library
      .artists()
      .filter((artist) => searchArtist(artist, props.query) && searchArtist(artist, search()))
      .sort(
        (a, b) =>
          (b.relations?.length ?? 0) - (a.relations?.length ?? 0) ||
          a.name.localeCompare(b.name, locale()),
      ),
  );
  const selected = createMemo(
    () =>
      library.artists().find((artist) => artist.reference === reference()) ??
      choices().find((artist) => artist.relations?.length) ??
      choices()[0],
  );
  const edges = createMemo(() => {
    const artist = selected();
    return artist ? neighbours(library.artists(), artist) : [];
  });
  const albums = createMemo(() =>
    library
      .albums()
      .filter((a) => selected()?.releaseRefs?.includes(a.reference))
      .sort(
        (a, b) => (a.year ?? 9999) - (b.year ?? 9999) || a.title.localeCompare(b.title, locale()),
      ),
  );
  const graphNodes = createMemo(() =>
    mode() === "album"
      ? albums()
          .slice(0, 16)
          .map((a) => ({
            reference: a.reference,
            name: a.title,
            weight: 1,
            source: t("catalogue Aède"),
            kind: "album" as const,
            href: `#/album/${encodeURIComponent(a.reference)}`,
          }))
      : edges().map((e) => ({
          reference: e.artist.reference,
          name: e.artist.name,
          weight: e.weight,
          source: e.source,
          kind: "artist" as const,
        })),
  );
  return (
    <section class="page relations-page">
      <div class="relation-picker">
        <label>
          {t("Artiste de départ")}{" "}
          <input
            type="search"
            aria-label={t("Chercher un artiste de départ")}
            placeholder={t("Chercher un artiste ou un musicien…")}
            value={search()}
            onInput={(event) => setSearch(event.currentTarget.value)}
          />
        </label>
        <div class="choices" aria-label={t("Artistes de départ proposés")}>
          <For each={choices().slice(0, 8)}>
            {(artist) => (
              <button
                aria-pressed={selected()?.reference === artist.reference}
                onClick={() => setReference(artist.reference)}
              >
                {artist.name}
              </button>
            )}
          </For>
        </div>
        <Show when={!choices().length}>
          <p class="muted">{t("Aucun artiste correspondant.")}</p>
        </Show>
      </div>
      <p class="muted">
        {t(
          "Liens de collaboration issus des crédits du catalogue Aède. Le nombre indique les pistes jouées ensemble ; il ne désigne pas une appartenance à un groupe.",
        )}{" "}
      </p>
      <Show
        when={selected()}
        fallback={<EmptyState icon="graph">{t("Aucun artiste disponible.")}</EmptyState>}
      >
        {(artist) => (
          <>
            <div class="section-heading">
              <h2>
                {mode() === "album" ? t("Albums associés à") : t("Collaborations de")}{" "}
                {artist().name}
              </h2>
              <div class="choices">
                <button aria-pressed={mode() === "artist"} onClick={() => setMode("artist")}>
                  {t("Artistes liés")}{" "}
                </button>
                <button aria-pressed={mode() === "album"} onClick={() => setMode("album")}>
                  {t("Albums liés")}{" "}
                </button>
              </div>
            </div>
            <Show
              when={graphNodes().length}
              fallback={
                <EmptyState icon="graph">
                  {t("Aucune collaboration locale connue pour")} {artist().name}.
                </EmptyState>
              }
            >
              <RelationGraph name={artist().name} edges={graphNodes()} onSelect={setReference} />
              <Show when={mode() === "artist"}>
                <p class="muted">
                  {t(
                    "Les 16 liens les plus forts sont affichés. Choisissez un voisin pour continuer l’exploration.",
                  )}{" "}
                </p>
                <ul class="personal-list">
                  <For each={edges()}>
                    {(edge) => (
                      <li>
                        <a href={`#/artist/${encodeURIComponent(edge.artist.reference)}`}>
                          {edge.artist.name}
                        </a>
                        <small>
                          {edge.weight} {t("pistes communes · Source :")}{" "}
                          {edge.source === "tags" ? t("crédits des fichiers") : edge.source}
                        </small>
                        <button onClick={() => setReference(edge.artist.reference)}>
                          {t("Explorer")}{" "}
                        </button>
                      </li>
                    )}
                  </For>
                </ul>
              </Show>
              <Show when={mode() === "album"}>
                <p class="muted">
                  {t(
                    "Discographie et participations issues du catalogue. Le graphe affiche les 16 premiers albums ; les pochettes ci-dessous donnent accès à l’ensemble.",
                  )}{" "}
                </p>
                <AlbumGrid compact={props.compact} albums={albums()} />
              </Show>
            </Show>
            <a href={`#/artist/${encodeURIComponent(artist().reference)}`}>
              {t("Ouvrir la page de")} {artist().name}
            </a>
          </>
        )}
      </Show>
    </section>
  );
}

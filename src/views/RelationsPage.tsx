import { createMemo, createSignal, For, Show } from "solid-js";
import { useLibrary } from "../library/context";
import { searchArtist } from "../library/filtering";
import { RelationGraph } from "../components/RelationGraph";
import { neighbours } from "../library/relations";
/** A bounded, keyboard-accessible view of Aède's actual local collaborations. */
export function RelationsPage(props: { query: string }) {
  const library = useLibrary(),
    [reference, setReference] = createSignal(""),
    [search, setSearch] = createSignal("");
  const choices = createMemo(() =>
    library
      .artists()
      .filter((artist) => searchArtist(artist, props.query) && searchArtist(artist, search()))
      .sort(
        (a, b) =>
          (b.relations?.length ?? 0) - (a.relations?.length ?? 0) ||
          a.name.localeCompare(b.name, "fr"),
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
  return (
    <section class="page relations-page">
      <div class="relation-picker">
        <label>
          Artiste de départ
          <input
            type="search"
            aria-label="Chercher un artiste de départ"
            placeholder="Chercher un artiste ou un musicien…"
            value={search()}
            onInput={(event) => setSearch(event.currentTarget.value)}
          />
        </label>
        <div class="choices" aria-label="Artistes de départ proposés">
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
          <p class="muted">Aucun artiste correspondant.</p>
        </Show>
      </div>
      <p class="muted">
        Liens de collaboration issus des crédits du catalogue Aède. Le nombre indique les pistes
        jouées ensemble ; il ne désigne pas une appartenance à un groupe.
      </p>
      <Show when={selected()} fallback={<p class="empty">Aucun artiste disponible.</p>}>
        {(artist) => (
          <>
            <h2>Collaborations de {artist().name}</h2>
            <Show
              when={edges().length}
              fallback={
                <p class="empty">Aucune collaboration locale connue pour {artist().name}.</p>
              }
            >
              <RelationGraph name={artist().name} edges={edges()} onSelect={setReference} />
              <p class="muted">
                Les 16 liens les plus forts sont affichés. Choisissez un voisin pour continuer
                l’exploration.
              </p>
              <ul class="personal-list">
                <For each={edges()}>
                  {(edge) => (
                    <li>
                      <a href={`#/artist/${encodeURIComponent(edge.artist.reference)}`}>
                        {edge.artist.name}
                      </a>
                      <small>
                        {edge.weight} pistes communes · Source :{" "}
                        {edge.source === "tags" ? "crédits des fichiers" : edge.source}
                      </small>
                      <button onClick={() => setReference(edge.artist.reference)}>Explorer</button>
                    </li>
                  )}
                </For>
              </ul>
            </Show>
            <a href={`#/artist/${encodeURIComponent(artist().reference)}`}>
              Ouvrir la page de {artist().name}
            </a>
          </>
        )}
      </Show>
    </section>
  );
}

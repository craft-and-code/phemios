import { createMemo, createSignal, For, Show } from "solid-js";
import { useLibrary } from "../library/context";
import { searchArtist } from "../library/filtering";
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
  const nodes = createMemo(() =>
    edges().map((edge, i, rows) => {
      const angle = -Math.PI / 2 + (i * 2 * Math.PI) / rows.length;
      return { ...edge, x: 450 + 300 * Math.cos(angle), y: 255 + 195 * Math.sin(angle) };
    }),
  );
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
              <svg
                class="relation-graph"
                viewBox="0 0 900 510"
                role="group"
                aria-label={`Collaborations de ${artist().name}`}
              >
                <For each={nodes()}>
                  {(node) => (
                    <>
                      <line
                        x1="450"
                        y1="255"
                        x2={node.x}
                        y2={node.y}
                        stroke-width={Math.min(4, 1 + Math.log2(node.weight + 1))}
                      />
                      <text class="edge-weight" x={(450 + node.x) / 2} y={(255 + node.y) / 2}>
                        {node.weight}
                      </text>
                      <g
                        class="relation-node"
                        transform={`translate(${node.x} ${node.y})`}
                        tabindex="0"
                        role="button"
                        aria-label={`Explorer ${node.artist.name}, ${node.weight} pistes communes`}
                        onClick={() => setReference(node.artist.reference)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            setReference(node.artist.reference);
                          }
                        }}
                      >
                        <title>
                          {node.artist.name} · {node.weight} pistes · {node.source}
                        </title>
                        <circle r="23" />
                        <text y="42" text-anchor="middle">
                          {node.artist.name.length > 23
                            ? `${node.artist.name.slice(0, 22)}…`
                            : node.artist.name}
                        </text>
                      </g>
                    </>
                  )}
                </For>
                <circle class="relation-center" cx="450" cy="255" r="45" />
                <text x="450" y="320" text-anchor="middle">
                  {artist().name}
                </text>
              </svg>
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

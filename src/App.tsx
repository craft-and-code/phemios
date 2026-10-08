import { createMemo, createResource, createSignal, For, onCleanup, onMount, Show } from "solid-js";
import { FilterBar } from "./components/FilterBar";
import { Icon } from "./components/Icon";
import { demoAlbums, demoArtists, demoYearDomain } from "./demo/catalog";
import type { Filters } from "./library/types";
import { parseRoute, sections } from "./navigation/routes";
import { getRuntimeInfo } from "./platform/desktop";
import { LibraryPage } from "./views/LibraryPage";
import { ArtistPage } from "./views/ArtistPage";
import { AlbumPage } from "./views/AlbumPage";
import { WorkspacePage } from "./views/WorkspacePage";

/** Offline shell: demonstration data is never represented as server state. */
export function App() {
  const [runtime] = createResource(getRuntimeInfo);
  const [route, setRoute] = createSignal(parseRoute(window.location.hash));
  const [sidebar, setSidebar] = createSignal(true);
  const [filters, setFilters] = createSignal<Filters>({
    mode: "both",
    years: demoYearDomain,
    alphabet: [0, 26],
    includeUnknownYear: true,
    query: "",
  });
  const [reverse, setReverse] = createSignal(false);
  const [compact, setCompact] = createSignal(false);
  const current = createMemo(() => route());
  const section = () => {
    const value = current();
    return value.kind === "section" ? value.section : "artists";
  };
  const context = () =>
    ["artists", "countries", "genres"].includes(section()) && current().kind === "section"
      ? "Initiale de l’artiste · année de ses albums"
      : "Initiale du titre · année de l’album";
  const hasFilters = () =>
    current().kind === "artist" ||
    (current().kind === "section" &&
      ["artists", "albums", "compilations", "countries", "genres"].includes(section()));
  onMount(() => {
    const sync = () => setRoute(parseRoute(window.location.hash));
    window.addEventListener("hashchange", sync);
    onCleanup(() => window.removeEventListener("hashchange", sync));
  });
  return (
    <div class="app" classList={{ "sidebar-hidden": !sidebar(), "density-compact": compact() }}>
      <header class="topbar">
        <button
          class="icon-button"
          aria-label={sidebar() ? "Masquer la navigation" : "Afficher la navigation"}
          aria-expanded={sidebar()}
          onClick={() => setSidebar(!sidebar())}
        >
          <Icon name="menu" />
        </button>
        <a class="wordmark" href="#/artists">
          phémios<span>.</span>
        </a>
        <label class="search">
          <Icon name="search" />
          <input
            type="search"
            aria-label="Rechercher dans le catalogue de démonstration"
            placeholder="Artiste, titre, pays, genre, tag…"
            value={filters().query}
            onInput={(event) => setFilters({ ...filters(), query: event.currentTarget.value })}
          />
        </label>
        <span class="demo-badge">DÉMONSTRATION</span>
      </header>
      <Show when={sidebar()}>
        <aside class="sidebar" aria-label="Navigation principale">
          <p class="nav-label">BIBLIOTHÈQUE</p>
          <nav>
            <For each={sections}>
              {(item, index) => (
                <>
                  <Show when={index() === 5}>
                    <p class="nav-label">VOTRE MUSIQUE</p>
                  </Show>
                  <Show when={index() === 9}>
                    <p class="nav-label">OUTILS</p>
                  </Show>
                  <a
                    href={`#/${item.id}`}
                    aria-current={section() === item.id ? "page" : undefined}
                  >
                    <Icon name={item.symbol} />
                    <span>{item.label}</span>
                  </a>
                </>
              )}
            </For>
          </nav>
          <div class="connection">
            <span class="status-dot" />
            Catalogue fictif, hors ligne
            <small>
              <Show when={runtime()} fallback="Initialisation du pont…">
                {runtime()?.native ? "Application desktop" : "Aperçu navigateur"}
              </Show>
            </small>
            <Show when={runtime.error}>
              <small role="alert">Pont desktop indisponible</small>
            </Show>
          </div>
        </aside>
      </Show>
      <main id="content">
        <Show when={hasFilters()}>
          <FilterBar
            value={filters()}
            setValue={setFilters}
            context={context()}
            yearDomain={demoYearDomain}
          />
          <div class="catalog-tools">
            <span>Les pochettes restent visibles dans les deux densités.</span>
            <button
              class="icon-button"
              title="Inverser l’ordre alphabétique"
              aria-label="Inverser l’ordre alphabétique"
              aria-pressed={reverse()}
              onClick={() => setReverse(!reverse())}
            >
              <Icon name="sort" />
            </button>
            <button
              class="icon-button"
              title="Vue compacte"
              aria-label="Vue compacte"
              aria-pressed={compact()}
              onClick={() => setCompact(!compact())}
            >
              <Icon name="layers" />
            </button>
          </div>
        </Show>
        <Show when={current().kind === "section"}>
          <Show
            when={["artists", "albums", "compilations", "countries", "genres"].includes(section())}
            fallback={<WorkspacePage section={section()} />}
          >
            <LibraryPage section={section()} filters={filters()} reverse={reverse()} />
          </Show>
        </Show>
        <Show when={current().kind === "artist"}>
          {(() => {
            const value = current();
            const artist = demoArtists.find(
              (item) => value.kind === "artist" && item.reference === value.reference,
            );
            return artist ? (
              <ArtistPage artist={artist} filters={filters()} reverse={reverse()} />
            ) : (
              <p class="empty">Artiste introuvable.</p>
            );
          })()}
        </Show>
        <Show when={current().kind === "album"}>
          {(() => {
            const value = current();
            const album = demoAlbums.find(
              (item) => value.kind === "album" && item.reference === value.reference,
            );
            return album ? <AlbumPage album={album} /> : <p class="empty">Album introuvable.</p>;
          })()}
        </Show>
        <Show when={current().kind === "not-found"}>
          <div class="empty">
            <h1>Page introuvable</h1>
            <a href="#/artists">Revenir aux artistes</a>
          </div>
        </Show>
      </main>
      <footer class="player-bar" aria-label="Lecture">
        <div>
          <Icon name="disc" />
          <span>
            Aucun morceau en lecture<small>Le moteur audio sera raccordé à Aède.</small>
          </span>
        </div>
        <button class="icon-button" disabled aria-label="Lecture indisponible">
          <Icon name="play" />
        </button>
        <div class="audio-settings">
          <Icon name="wave" />
          <label>
            Volume
            <input type="range" disabled aria-label="Volume indisponible" />
          </label>
          <select disabled aria-label="Sortie audio indisponible">
            <option>Sortie audio non connectée</option>
          </select>
        </div>
      </footer>
    </div>
  );
}

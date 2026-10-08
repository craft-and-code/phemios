import {
  createEffect,
  createMemo,
  createResource,
  createSignal,
  For,
  onCleanup,
  onMount,
  Show,
} from "solid-js";
import { browseArtists } from "./library/selection";
import { catalogIndex } from "./library/index";
import { distributions } from "./library/distribution";
import { PlayerBar } from "./components/PlayerBar";
import { FilterBar } from "./components/FilterBar";
import { Icon } from "./components/Icon";
import { useLibrary } from "./library/context";
import { ConnectionPanel } from "./components/ConnectionPanel";
import type { Filters } from "./library/types";
import { parseRoute, sections } from "./navigation/routes";
import { getRuntimeInfo } from "./platform/desktop";
import { LibraryPage } from "./views/LibraryPage";
import { ArtistPage } from "./views/ArtistPage";
import { AlbumPage } from "./views/AlbumPage";
import { WorkspacePage } from "./views/WorkspacePage";

/** Offline shell: demonstration data is never represented as server state. */
export function App() {
  const library = useLibrary();
  const [connectionPanel, setConnectionPanel] = createSignal(false);
  const principalArtists = createMemo(() => browseArtists(library.artists(), library.albums()));
  const yearDomain = createMemo(() => {
    const values = library.snapshot()?.albums ?? (library.demo ? library.albums() : []);
    let low = Infinity,
      high = -Infinity;
    for (const album of values)
      if (album.year !== null) {
        low = Math.min(low, album.year);
        high = Math.max(high, album.year);
      }
    return Number.isFinite(low) ? ([low, high] as const) : ([0, 0] as const);
  });
  const [runtime] = createResource(getRuntimeInfo);
  const [route, setRoute] = createSignal(parseRoute(window.location.hash));
  const [sidebar, setSidebar] = createSignal(true);
  const [filters, setFilters] = createSignal<Filters>({
    mode: "years",
    years: [0, 0],
    alphabet: [0, 26],
    includeUnknownYear: true,
    query: "",
  });
  createEffect(() => {
    const domain = yearDomain();
    if (Number.isFinite(domain[0])) setFilters((previous) => ({ ...previous, years: domain }));
  });
  const [reverse, setReverse] = createSignal(false);
  const [compact, setCompact] = createSignal(false);
  const current = createMemo(() => route());
  const section = () => {
    const value = current();
    return value.kind === "section" ? value.section : "artists";
  };
  const selectedArtist = createMemo(() => {
    const value = current();
    return value.kind === "artist"
      ? library.artists().find((item) => item.reference === value.reference)
      : undefined;
  });
  const selectedAlbum = createMemo(() => {
    const value = current();
    return value.kind === "album"
      ? library.albums().find((item) => item.reference === value.reference)
      : undefined;
  });
  const artistReleases = createMemo(() => {
    const route = current();
    return route.kind === "artist"
      ? (catalogIndex(library.artists(), library.albums()).albumsByArtist.get(route.reference) ??
          [])
      : library.albums();
  });
  const context = () =>
    ["artists", "countries", "genres"].includes(section()) && current().kind === "section"
      ? "Initiale de l’artiste · année de ses albums"
      : "Initiale du titre · année de l’album";
  const hasFilters = () =>
    current().kind === "artist" ||
    (current().kind === "section" &&
      ["artists", "albums", "compilations", "countries", "genres"].includes(section()));
  onMount(() => {
    const sync = () => {
      setRoute(parseRoute(window.location.hash));
      document.getElementById("content")?.scrollTo({ top: 0 });
    };
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
            aria-label="Rechercher dans tous les champs du catalogue"
            placeholder="Artiste, titre, pays, genre, tag…"
            value={filters().query}
            onInput={(event) => setFilters({ ...filters(), query: event.currentTarget.value })}
          />
        </label>
        <button class="server-button" onClick={() => setConnectionPanel(!connectionPanel())}>
          {library.session() ? "Aède connecté" : "Connexion Aède"}
        </button>
      </header>
      <Show when={connectionPanel()}>
        <ConnectionPanel onClose={() => setConnectionPanel(false)} />
      </Show>
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
            {library.demo
              ? "Aperçu hors ligne"
              : library.session()
                ? "Bibliothèque Aède"
                : "Cache local · hors ligne"}
            <small>
              {principalArtists().length} artistes d’album · {library.albums().length} albums
            </small>
            <Show when={library.mediaProgress()[1]}>
              <small>
                Images {library.mediaProgress()[0]} / {library.mediaProgress()[1]}
              </small>
            </Show>
            <Show when={library.mediaErrors()}>
              <small role="status">
                {library.mediaErrors()} image(s) indisponible(s) · resynchronisez pour réessayer
              </small>
            </Show>
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
        <Show when={library.error() && !connectionPanel()}>
          <p class="notice" role="alert">
            {library.error()}
          </p>
        </Show>
        <Show when={!library.artists().length && !library.busy()}>
          <div class="empty">
            <p>Connectez votre serveur Aède pour synchroniser la bibliothèque.</p>
            <button class="primary" onClick={() => setConnectionPanel(true)}>
              Configurer la connexion
            </button>
          </div>
        </Show>
        <Show when={hasFilters() && library.artists().length}>
          <FilterBar
            value={filters()}
            setValue={setFilters}
            context={context()}
            yearDomain={yearDomain()}
            hasUnknownYear={artistReleases().some((album) => album.year === null)}
            histogram={distributions(
              current().kind === "section" && ["artists", "countries", "genres"].includes(section())
                ? principalArtists()
                : library.artists(),
              artistReleases(),
              filters(),
              current().kind === "section" &&
                ["artists", "countries", "genres"].includes(section()),
            )}
            countLabel={
              current().kind === "section" && ["artists", "countries", "genres"].includes(section())
                ? "artistes"
                : "albums"
            }
          />
          <div class="catalog-tools">
            <span>{library.busy() ? "Synchronisation…" : ""}</span>
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
            fallback={<WorkspacePage section={section()} query={filters().query} />}
          >
            <LibraryPage
              section={section()}
              filters={filters()}
              setFilters={setFilters}
              reverse={reverse()}
            />
          </Show>
        </Show>
        <Show when={current().kind === "artist"}>
          <Show when={selectedArtist()} fallback={<p class="empty">Artiste introuvable.</p>}>
            {(artist) => <ArtistPage artist={artist()} filters={filters()} reverse={reverse()} />}
          </Show>
        </Show>
        <Show when={current().kind === "album"}>
          <Show when={selectedAlbum()} fallback={<p class="empty">Album introuvable.</p>}>
            {(album) => <AlbumPage album={album()} />}
          </Show>
        </Show>
        <Show when={current().kind === "not-found"}>
          <div class="empty">
            <h1>Page introuvable</h1>
            <a href="#/artists">Revenir aux artistes</a>
          </div>
        </Show>
      </main>
      <PlayerBar />
    </div>
  );
}

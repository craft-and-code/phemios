import {
  createEffect,
  ErrorBoundary,
  createMemo,
  createResource,
  createSignal,
  For,
  Show,
} from "solid-js";
import { createNavigation, browserNavigationHost } from "./navigation/history";
import { browseArtists } from "./library/selection";
import { catalogRails } from "./navigation/rails";
import { distributions } from "./library/distribution";
import { SelectionCollection } from "./components/SelectionCollection";
import { RadioPlayerBar } from "./components/RadioPlayerBar";
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
import { createTrackPaging } from "./navigation/track-paging";
import { TracksPage } from "./views/TracksPage";
import { TrackPage } from "./views/TrackPage";
import { RecentPage } from "./views/RecentPage";
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
  const navigation = createNavigation(browserNavigationHost(), (hash) => {
    const source = parseRoute(hash);
    if (source.kind === "section")
      return sections.find((s) => s.id === source.section)?.label ?? "Catalogue";
    if (source.kind === "artist")
      return library.artists().find((a) => a.reference === source.reference)?.name ?? "Artiste";
    if (source.kind === "album")
      return library.albums().find((a) => a.reference === source.reference)?.title ?? "Album";
    return "Catalogue";
  });
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
  const trackPaging = createTrackPaging(() => filters().query, library.session);
  const [reverse, setReverse] = createSignal(false);
  const [compact, setCompact] = createSignal(false);
  const current = navigation.route,
    section = navigation.section;
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
  createEffect(() => {
    library.player.setTarget(
      selectedAlbum()?.reference ??
        selectedArtist()?.reference ??
        (current().kind === "track" ? (current() as { reference: string }).reference : ""),
    );
  });
  const backLink = navigation.backLink;
  const context = () =>
    ["artists", "countries", "genres"].includes(section()) && current().kind === "section"
      ? "Initiale de l’artiste · année de ses albums"
      : "Initiale du titre · année de l’album";
  const hasFilters = () => catalogRails(current());
  return (
    <div
      class="app"
      classList={{ "sidebar-hidden": !sidebar(), "density-compact": compact() }}
      onContextMenu={(event) => event.preventDefault()}
      onClick={(event) => {
        if (
          event.defaultPrevented ||
          event.button !== 0 ||
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey
        )
          return;
        const anchor =
          event.target instanceof Element ? event.target.closest("a[href^='#/']") : null;
        if (!anchor || anchor.getAttribute("target")) return;
        const href = anchor.getAttribute("href");
        if (anchor.hasAttribute("data-navigation-back")) {
          event.preventDefault();
          navigation.goBack();
        } else if (href && navigation.navigate(href)) event.preventDefault();
      }}
    >
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
          <span
            class="server-indicator"
            classList={{ online: library.connected() }}
            aria-hidden="true"
          />
          {library.connected()
            ? "Aède connecté"
            : library.session()
              ? "Connexion Aède perdue"
              : "Connexion Aède"}
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
              {(item) => (
                <>
                  <Show when={item.id === "favourites"}>
                    <p class="nav-label">VOTRE MUSIQUE</p>
                  </Show>
                  <Show when={item.id === "radio"}>
                    <p class="nav-label">SOURCES MUSICALES</p>
                  </Show>
                  <Show when={item.id === "doctor"}>
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
                {runtime()?.native ? "Application desktop" : "Aperçu navigateur"} ·{" "}
                {runtime()?.version}
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
        <Show when={!library.artists().length && !library.busy() && section() !== "radio"}>
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
            hasUnknownYear={library.albums().some((album) => album.year === null)}
            histogram={distributions(
              current().kind === "section" && ["artists", "countries", "genres"].includes(section())
                ? principalArtists()
                : library.artists(),
              library.albums(),
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
        </Show>
        <Show when={(hasFilters() || backLink()) && library.artists().length}>
          <div class="catalog-tools">
            <Show when={backLink()}>
              {(link) => (
                <a class="back" href={link().href} data-navigation-back>
                  <Icon name="back" /> {link().label}
                </a>
              )}
            </Show>
            <span>{library.busy() ? "Synchronisation…" : ""}</span>
            <Show when={hasFilters()}>
              <SelectionCollection section={section()} filters={filters()} />
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
            </Show>
          </div>
        </Show>
        <Show when={current()} keyed>
          {(route) => (
            <ErrorBoundary
              fallback={(error) => (
                <div class="page" role="alert">
                  <p>Cette page est indisponible : {String(error)}</p>
                  <a href="#/artists">Revenir aux artistes</a>
                </div>
              )}
            >
              <Show when={route.kind === "section"}>
                <Show
                  when={["artists", "albums", "compilations", "countries", "genres"].includes(
                    section(),
                  )}
                  fallback={
                    <Show
                      when={section() === "tracks"}
                      fallback={
                        <Show
                          when={section() === "recent"}
                          fallback={<WorkspacePage section={section()} query={filters().query} />}
                        >
                          <RecentPage query={filters().query} />
                        </Show>
                      }
                    >
                      <TracksPage
                        query={filters().query}
                        offset={trackPaging.offset()}
                        setOffset={trackPaging.setOffset}
                      />
                    </Show>
                  }
                >
                  <LibraryPage
                    section={section()}
                    filters={filters()}
                    setFilters={setFilters}
                    reverse={reverse()}
                  />
                </Show>
              </Show>
              <Show when={route.kind === "artist"}>
                <Show when={selectedArtist()} fallback={<p class="empty">Artiste introuvable.</p>}>
                  {(artist) => (
                    <ArtistPage
                      artist={artist()}
                      reverse={reverse()}
                      onGenres={(genres) => {
                        setFilters({
                          ...filters(),
                          mode: "none",
                          query: "",
                          countries: [],
                          genre: undefined,
                          genres,
                        });
                        navigation.navigate("#/genres");
                      }}
                      onCountry={(country) => {
                        setFilters({
                          ...filters(),
                          mode: "none",
                          query: "",
                          genre: undefined,
                          genres: [],
                          countries: [country],
                        });
                        navigation.navigate("#/countries");
                      }}
                    />
                  )}
                </Show>
              </Show>
              <Show when={route.kind === "album"}>
                <Show when={selectedAlbum()} fallback={<p class="empty">Album introuvable.</p>}>
                  {(album) => <AlbumPage album={album()} />}
                </Show>
              </Show>
              <Show when={route.kind === "track"}>
                <TrackPage reference={(route as { reference: string }).reference} />
              </Show>
              <Show when={route.kind === "not-found"}>
                <div class="empty">
                  <h1>Page introuvable</h1>
                  <a href="#/artists">Revenir aux artistes</a>
                </div>
              </Show>
            </ErrorBoundary>
          )}
        </Show>
      </main>
      <Show when={library.radio.station()} fallback={<PlayerBar />}>
        <RadioPlayerBar />
      </Show>
    </div>
  );
}

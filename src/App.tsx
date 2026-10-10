import { createMenuPreferences, visibleMenu, menuItem } from "./navigation/menu-preferences";
import { LabelsPage } from "./views/LabelsPage";
import { LabelPage } from "./views/LabelPage";
import { createToolPreferences } from "./library/tool-preferences";
import { t } from "./i18n";
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
import { browseArtists, selectAlbumYear } from "./library/selection";
import { catalogRails } from "./navigation/rails";
import { filterArtists, filterAlbums } from "./library/filtering";
import { distributions } from "./library/distribution";
import { PodcastPlayerBar } from "./components/PodcastPlayerBar";
import { SelectionCollection } from "./components/SelectionCollection";
import { RadioPlayerBar } from "./components/RadioPlayerBar";
import { PlayerBar } from "./components/PlayerBar";
import { FilterBar } from "./components/FilterBar";
import { Icon } from "./components/Icon";
import { useLibrary } from "./library/context";
import { SettingsPage } from "./views/SettingsPage";
import { sourceLabel } from "./library/sources";
import { createScopedFilters } from "./navigation/scoped-filters";
import { parseRoute, sections } from "./navigation/routes";
import { getRuntimeInfo } from "./platform/desktop";
import { LibraryPage } from "./views/LibraryPage";
import { ArtistPage } from "./views/ArtistPage";
import { createTrackPaging } from "./navigation/track-paging";
import { TracksPage } from "./views/TracksPage";
import { TrackPage } from "./views/TrackPage";
import { TagsPage } from "./views/TagsPage";
import { RecentPage } from "./views/RecentPage";
import { AlbumPage } from "./views/AlbumPage";
import { WorkspacePage } from "./views/WorkspacePage";

/** Offline shell: demonstration data is never represented as server state. */
export function App() {
  const library = useLibrary();
  const browsing = createToolPreferences();
  const menu = createMenuPreferences();
  const visibleMenus = createMemo(() => visibleMenu(menu.value()).map(menuItem));
  const connectionPanel = () => false;
  const setConnectionPanel = (_value: boolean) => {
    navigation.navigate("#/settings");
  };
  const principalArtists = createMemo(() => browseArtists(library.artists(), library.albums()));
  const yearDomain = createMemo(() => {
    const values = [...(library.snapshot()?.albums ?? (library.demo ? library.albums() : []))];
    let low = Infinity,
      high = -Infinity;
    for (const album of values)
      if (album.year !== null) {
        low = Math.min(low, album.year);
        high = Math.max(high, album.year);
      }
    return Number.isFinite(low) ? ([low, high] as const) : ([0, 0] as const);
  });
  const [labelTitle, setLabelTitle] = createSignal("");
  const [runtime] = createResource(getRuntimeInfo);
  const navigation = createNavigation(browserNavigationHost(), (hash) => {
    const source = parseRoute(hash);
    if (source.kind === "section")
      return sections.find((s) => s.id === source.section)?.label ?? t("Catalogue");
    if (source.kind === "artist")
      return library.artists().find((a) => a.reference === source.reference)?.name ?? t("Artiste");
    if (source.kind === "album")
      return library.albums().find((a) => a.reference === source.reference)?.title ?? "Album";
    if (source.kind === "label") return labelTitle() || t("Label");
    return t("Catalogue");
  });
  const [sidebar, setSidebar] = createSignal(true);
  const scopedFilters = createScopedFilters(navigation.section, yearDomain);
  const filters = scopedFilters.value,
    setFilters = scopedFilters.set;
  const trackPaging = createTrackPaging(
    () => filters().query,
    () => library.trackSources(),
    () => browsing.value().trackPageSize,
  );
  const [selectedTag, setSelectedTag] = createSignal<readonly string[]>([]);
  const [tagOffset, setTagOffset] = createSignal(0);
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
        (["track", "label"].includes(current().kind)
          ? (current() as { reference: string }).reference
          : ""),
    );
  });
  const backLink = navigation.backLink;
  const context = () =>
    ["artists", "countries", "genres"].includes(section()) && current().kind === "section"
      ? t("Initiale de l’artiste · année de ses albums")
      : t("Initiale du titre · année de l’album");
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
          aria-label={sidebar() ? t("Masquer la navigation") : t("Afficher la navigation")}
          aria-expanded={sidebar()}
          onClick={() => setSidebar(!sidebar())}
        >
          <Icon name="menu" />
        </button>
        <a class="wordmark" href="#/artists">
          {t("phémios")}
          <span>.</span>
        </a>
        <div class="search">
          <a
            class="advanced-search-action"
            href="#/advanced-search"
            title={t("Recherche avancée")}
            aria-label={t("Recherche avancée")}
          >
            <Icon name="search" />
            <span>{t("Avancée")}</span>
          </a>
          <input
            type="search"
            aria-label={
              current().kind === "section" && section() === "tags"
                ? t("Rechercher un tag")
                : t("Rechercher dans tous les champs du catalogue")
            }
            placeholder={
              current().kind === "section" && section() === "tags"
                ? t("Rechercher un tag")
                : t("Artiste, titre, pays, genre, tag…")
            }
            value={filters().query}
            onInput={(event) => {
              setFilters({ ...filters(), query: event.currentTarget.value });
              if (section() === "tags") {
                setSelectedTag([]);
                setTagOffset(0);
              }
            }}
          />
        </div>
        <a
          class="server-button settings-button"
          href="#/settings"
          aria-label={t("Paramètres")}
          title={t("Paramètres")}
        >
          <span
            class="server-indicator"
            classList={{
              online: library.connected(),
              unnecessary: !!library.localSession() && !library.serverSession(),
            }}
            aria-hidden="true"
          />
          <Icon name="gear" />
        </a>
      </header>
      <Show when={sidebar()}>
        <aside class="sidebar" aria-label={t("Navigation principale")}>
          <nav>
            <For each={visibleMenus()}>
              {(item) => (
                <>
                  <Show when={item.kind === "heading"}>
                    <p class="nav-label">{t(item.label)}</p>
                  </Show>
                  <Show when={item.kind === "separator"}>
                    <div class="nav-spacer" aria-hidden="true" />
                  </Show>
                  <Show when={item.kind === "section"}>
                    <a
                      href={`#/${item.id}`}
                      aria-current={section() === item.id ? "page" : undefined}
                    >
                      <Icon name={item.symbol} />
                      <span>{t(item.label)}</span>
                    </a>
                  </Show>
                </>
              )}
            </For>
          </nav>
          <div class="connection">
            <span class="status-dot" />
            {library.demo
              ? t("Aperçu hors ligne")
              : library.session()
                ? t("Bibliothèque Aède")
                : t("Cache local · hors ligne")}
            <small>
              {principalArtists().length} {t("artistes d’album ·")} {library.albums().length}{" "}
              {t("albums")}{" "}
            </small>
            <Show when={library.mediaProgress()[1]}>
              <small>
                {t("Images")} {library.mediaProgress()[0]} / {library.mediaProgress()[1]}
              </small>
            </Show>
            <Show when={library.mediaErrors()}>
              <small role="status">
                {library.mediaErrors()}{" "}
                {t("image(s) indisponible(s) · resynchronisez pour réessayer")}{" "}
              </small>
            </Show>
            <small>
              <Show when={runtime()} fallback={t("Initialisation du pont…")}>
                {runtime()?.native ? t("Application desktop") : t("Aperçu navigateur")} ·{" "}
                {runtime()?.version}
              </Show>
            </small>
            <Show when={runtime.error}>
              <small role="alert">{t("Pont desktop indisponible")}</small>
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
        <Show
          when={
            !library.artists().length &&
            !library.busy() &&
            !["radio", "podcasts", "settings", "advanced-search"].includes(section())
          }
        >
          <div class="empty">
            <p>{t("Connectez votre serveur Aède pour synchroniser la bibliothèque.")}</p>
            <button class="primary" onClick={() => setConnectionPanel(true)}>
              {t("Configurer la connexion")}{" "}
            </button>
          </div>
        </Show>
        <Show when={hasFilters() && library.artists().length}>
          <FilterBar
            resultCount={
              ["artists", "countries", "genres"].includes(section())
                ? filterArtists(principalArtists(), library.albums(), filters()).length
                : filterAlbums(library.albums(), library.artists(), filters()).filter(
                    (album) => section() !== "compilations" || album.compilation,
                  ).length
            }
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
                ? t("artistes")
                : "albums"
            }
          />
        </Show>
        <Show when={(hasFilters() || backLink()) && library.artists().length}>
          <div class="catalog-tools">
            <Show when={backLink()}>
              {(link) => (
                <a class="back" href={link().href} data-navigation-back>
                  <Icon name="back" />{" "}
                  {parseRoute(link().href).kind === "section" ? t(link().label) : link().label}
                </a>
              )}
            </Show>
            <span>{library.busy() ? t("Synchronisation…") : ""}</span>
            <Show when={hasFilters()}>
              <button
                class="icon-button"
                title={t("Inverser l’ordre alphabétique")}
                aria-label={t("Inverser l’ordre alphabétique")}
                aria-pressed={reverse()}
                onClick={() => setReverse(!reverse())}
              >
                <Icon name="sort" />
              </button>
              <button
                class="icon-button"
                title={t("Vue compacte")}
                aria-label={t("Vue compacte")}
                aria-pressed={compact()}
                onClick={() => setCompact(!compact())}
              >
                <Icon name="layers" />
              </button>
              <SelectionCollection section={section()} filters={filters()} />
            </Show>
          </div>
        </Show>
        <Show
          when={
            current().kind === "section" &&
            ![
              "artists",
              "albums",
              "compilations",
              "countries",
              "genres",
              "recent",
              "tracks",
              "tags",
              "labels",
              "radio",
              "podcasts",
              "settings",
              "relations",
              "players",
            ].includes(section()) &&
            library.origins().length > 1
          }
        >
          <div class="choices library-source" aria-label={t("Origine des données personnelles")}>
            <For each={library.origins()}>
              {(source) => (
                <button
                  aria-pressed={library.source() === source}
                  onClick={() => library.chooseSource(source)}
                >
                  {sourceLabel(source)}
                </button>
              )}
            </For>
          </div>
        </Show>
        <Show when={current()} keyed>
          {(route) => (
            <ErrorBoundary
              fallback={(error) => (
                <div class="page" role="alert">
                  <p>
                    {t("Cette page est indisponible :")} {String(error)}
                  </p>
                  <a href="#/artists">{t("Revenir aux artistes")}</a>
                </div>
              )}
            >
              <Show when={route.kind === "section" && section() === "labels"}>
                <LabelsPage query={filters().query} />
              </Show>
              <Show when={route.kind === "section" && section() !== "labels"}>
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
                          fallback={
                            <Show
                              when={section() === "settings"}
                              fallback={
                                <Show
                                  when={section() === "tags"}
                                  fallback={
                                    <WorkspacePage section={section()} query={filters().query} />
                                  }
                                >
                                  <TagsPage
                                    query={filters().query}
                                    selected={selectedTag()}
                                    onSelect={(value) => {
                                      setSelectedTag(value);
                                      setTagOffset(0);
                                    }}
                                    offset={tagOffset()}
                                    setOffset={setTagOffset}
                                  />
                                </Show>
                              }
                            >
                              <SettingsPage menu={menu} />
                            </Show>
                          }
                        >
                          <RecentPage query={filters().query} />
                        </Show>
                      }
                    >
                      <TracksPage
                        query={filters().query}
                        size={browsing.value().trackPageSize}
                        setSize={(size) => browsing.update({ trackPageSize: size })}
                        preferenceError={browsing.error()}
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
                <Show
                  when={selectedArtist()}
                  fallback={<p class="empty">{t("Artiste introuvable.")}</p>}
                >
                  {(artist) => (
                    <ArtistPage
                      artist={artist()}
                      onGenres={(genres) => {
                        scopedFilters.select("genres", {
                          mode: "none",
                          query: "",
                          countries: [],
                          genre: undefined,
                          genres,
                        });
                        navigation.navigate("#/genres");
                      }}
                      onCountry={(country) => {
                        scopedFilters.select("countries", {
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
                <Show
                  when={selectedAlbum()}
                  fallback={<p class="empty">{t("Album introuvable.")}</p>}
                >
                  {(album) => (
                    <AlbumPage
                      album={album()}
                      onYear={(year) => {
                        scopedFilters.select("albums", selectAlbumYear(filters(), year));
                        navigation.navigate("#/albums");
                      }}
                    />
                  )}
                </Show>
              </Show>
              <Show when={route.kind === "label"}>
                <LabelPage
                  reference={(route as { reference: string }).reference}
                  onTitle={setLabelTitle}
                  compact={compact()}
                  onCompact={() => setCompact(!compact())}
                />
              </Show>
              <Show when={route.kind === "track"}>
                <TrackPage reference={(route as { reference: string }).reference} />
              </Show>
              <Show when={route.kind === "not-found"}>
                <div class="empty">
                  <h1>{t("Page introuvable")}</h1>
                  <a href="#/artists">{t("Revenir aux artistes")}</a>
                </div>
              </Show>
            </ErrorBoundary>
          )}
        </Show>
      </main>
      <Show
        when={library.podcast.episode()}
        fallback={
          <Show when={library.radio.station()} fallback={<PlayerBar />}>
            <RadioPlayerBar />
          </Show>
        }
      >
        <PodcastPlayerBar />
      </Show>
    </div>
  );
}

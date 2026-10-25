import { ViewSessionProvider, useViewSession } from "./navigation/ViewSession";
import { createCollectionMenuChoices } from "./library/collection-menu-choices";
import { createCollectionAlbums } from "./library/collection-albums";
import { AlbumCatalog, type AlbumCatalogControls } from "./views/AlbumCatalog";
import { createCatalogPresentation, supportsCoverFlow } from "./navigation/catalog-presentation";
import {
  isCollectionMenuId,
  collectionMenuHref,
  collectionMenuName,
  reconcileCollectionMenus,
} from "./navigation/collection-menu";
import { controlAudioShortcut, toggleAudioShortcut } from "./navigation/audio-shortcut";
import { ConnectionNotice } from "./components/ConnectionNotice";
import type { BiographyReturn } from "./library/biography-navigation";
import { CatalogSearch } from "./components/CatalogSearch";
import { searchContext } from "./navigation/search-context";
import { AlbumCount } from "./components/AlbumCount";
import { BrandWordmark } from "./components/BrandWordmark";
import { parentalRouteAllowed } from "./library/parental-route";
import { EmptyState } from "./components/EmptyState";
import { ParentalNotice } from "./components/ParentalNotice";
import { RecentAlbumsFilter } from "./components/RecentAlbumsFilter";
import { ArtistViewActions } from "./components/ArtistViewActions";
import { CatalogActions } from "./components/CatalogActions";
import { CoverSize } from "./components/CoverSize";
import { StickyHeader } from "./components/StickyHeader";
import { createCoverPosition } from "./visualizer/cover-position";
import {
  contextualReference,
  footerTransport,
  isQueueWorkspace,
} from "./navigation/contextual-play";
import { Feedback } from "./components/Feedback";
import { AedeDiagnosticDialog } from "./components/AedeDiagnosticDialog";
import { aedeDiagnostics } from "./library/aede-diagnostics";
import { activateExternalLink } from "./navigation/external-links";
import { isNative, openExternalLink } from "./platform/desktop";
import { needsCatalogPrompt } from "./navigation/catalog-prompt";
import { createShortcuts, shortcutAction } from "./navigation/shortcuts";
import {
  createMenuPreferences,
  visibleMenu,
  menuItem,
  menuLabel,
} from "./navigation/menu-preferences";
import { LabelsPage } from "./views/LabelsPage";
import { LabelPage } from "./views/LabelPage";
import { createToolPreferences } from "./library/tool-preferences";
import { t } from "./i18n";
import {
  onMount,
  onCleanup,
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
import { parseRoute, artistCatalog, navigationLabel } from "./navigation/routes";
import { getRuntimeInfo } from "./platform/desktop";
import { LibraryPage } from "./views/LibraryPage";
import { ArtistPage } from "./views/ArtistPage";
import { createTrackPaging } from "./navigation/track-paging";
import { TracksPage } from "./views/TracksPage";
import { TrackPage } from "./views/TrackPage";
import { TagsPage } from "./views/TagsPage";
import { AlbumPage } from "./views/AlbumPage";
import { WorkspacePage } from "./views/WorkspacePage";

/** Offline shell: demonstration data is never represented as server state. */
export function App() {
  return (
    <ViewSessionProvider>
      <AppContent />
    </ViewSessionProvider>
  );
}

/** Navigation may remount pages without recreating their presentation memory. */
function AppContent() {
  const library = useLibrary();
  const browsing = createToolPreferences();
  const menu = createMenuPreferences();
  const shortcuts = createShortcuts();
  const [recentNow, setRecentNow] = createSignal(Math.floor(Date.now() / 1000));
  const visibleMenus = createMemo(() =>
    visibleMenu(
      menu.value(),
      new Set([
        ...(!library.session() ? menu.value().order.filter(isCollectionMenuId) : []),
        ...(library.parental.radioAllowed() ? [] : ["radio" as const]),
        ...(library.parental.podcastsAllowed() ? [] : ["podcasts" as const]),
      ]),
    ).map((id) => ({
      ...menuItem(id, menu.value()),
      label: menuLabel(id, menu.value()),
    })),
  );
  const principalArtists = createMemo(() => browseArtists(library.artists(), library.albums()));
  const collectionDirectory = createCollectionMenuChoices(() => {
    const session = library.session();
    return session ? { session, source: library.source() } : false;
  });
  createEffect(() => {
    const rows = collectionDirectory.rows();
    if (
      !collectionDirectory.identity() ||
      collectionDirectory.loading() ||
      collectionDirectory.error()
    )
      return;
    const current = menu.value(),
      next = reconcileCollectionMenus(current, rows);
    if (next !== current) menu.update(next);
  });
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
  const navigation = createNavigation(browserNavigationHost(), (hash) =>
    navigationLabel(
      parseRoute(hash),
      (section, collectionMenu) => menuLabel(collectionMenu ?? section, menu.value()),
      (source) => {
        if (source.kind === "artist")
          return library.artists().find((a) => a.reference === source.reference)?.name;
        if (source.kind === "album")
          return library.albums().find((a) => a.reference === source.reference)?.title;
        if (source.kind === "label") return labelTitle() || undefined;
        return library.player.current()?.reference === source.reference
          ? library.player.current()?.title
          : undefined;
      },
    ),
  );
  const [sidebar, setSidebar] = createSignal(true);
  const filterOwner = createMemo(() => ({ session: library.session(), source: library.source() }));
  const scopedFilters = createScopedFilters(
    () => navigation.collectionMenu() ?? navigation.section(),
    yearDomain,
    filterOwner,
  );
  const filters = scopedFilters.value,
    setFilters = scopedFilters.set;
  function browseAlbumYear(year: number) {
    scopedFilters.select("albums", selectAlbumYear(filters(), year));
    navigation.navigate("#/albums");
  }

  const trackPaging = createTrackPaging(
    () => filters().query,
    () => library.trackSources(),
    () => browsing.value().trackPageSize,
  );
  const [selectedTag, setSelectedTag] = createSignal<readonly string[]>([]);
  const [tagOffset, setTagOffset] = createSignal(0);
  createEffect(() => {
    filterOwner();
    setSelectedTag([]);
    setTagOffset(0);
  });
  const [catalogReverse, setCatalogReverse] = useViewSession().control("catalogReverse");
  const catalogScope = () => navigation.collectionMenu() ?? navigation.section();
  const reverse = () => catalogReverse()[catalogScope()] ?? false;
  const setReverse = (value: boolean) =>
    setCatalogReverse({ ...catalogReverse(), [catalogScope()]: value });
  const presentation = createCatalogPresentation(
    () => navigation.collectionMenu() ?? navigation.section(),
  );
  const coverFlow = () => presentation.value() === "cover-flow";
  const coverPosition = createCoverPosition();
  const compact = () => presentation.value() === "list";
  const setCompact = (value: boolean) => presentation.select(value ? "list" : "grid");
  const current = navigation.route,
    section = navigation.section;
  const catalogSection = () => (navigation.collectionMenu() ? "albums" : section());
  const collectionTarget = createMemo(() => {
    const route = current();
    return route.kind === "section" && route.collectionMenu
      ? {
          error: collectionDirectory.error(),
          id: menu.value().collectionIds?.[route.collectionMenu],
          name: collectionMenuName(menu.value(), route.collectionMenu),
          label: menuLabel(route.collectionMenu, menu.value()),
        }
      : undefined;
  });
  const collectionRead = createCollectionAlbums(() => {
    const target = collectionTarget(),
      session = library.session();
    return target?.id &&
      target.name &&
      !target.error &&
      session &&
      parentalRouteAllowed(current(), library.parental.available)
      ? {
          id: target.id,
          name: target.name,
          session,
          source: library.source(),
          albums: library.albums(),
        }
      : false;
  });
  const catalogAlbums = () =>
    collectionTarget() ? (collectionRead.current() ?? []) : library.albums();
  const albumCatalog: AlbumCatalogControls = {
    get filters() {
      return filters();
    },
    setFilters,
    get now() {
      return filters().recentOnly ? recentNow() : 0;
    },
    get compact() {
      return compact();
    },
    get reverse() {
      return reverse();
    },
    get coverFlow() {
      return coverFlow();
    },
    get coverSize() {
      return browsing.value().coverSizes.albums ?? browsing.value().coverSize;
    },
    coverPosition,
  };
  const footer = createMemo(() =>
    footerTransport({
      queueView: isQueueWorkspace(current()),
      queued: library.player.queue().length > 0,
      podcast: !!library.podcast.episode(),
      radio: !!library.radio.station(),
    }),
  );
  const pageRoute = createMemo(() => {
    library.parental.viewScope();
    return { ...current() };
  });
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
  onMount(() => {
    const recentClock = window.setInterval(
      () => setRecentNow(Math.floor(Date.now() / 1000)),
      60000,
    );
    onCleanup(() => window.clearInterval(recentClock));
    function key(event: KeyboardEvent) {
      const editing =
        event.target instanceof Element &&
        (!!event.target.closest(
          "input:not([type=range]), textarea, select, [contenteditable], dialog[open]",
        ) ||
          (event.code !== "Space" && !!event.target.closest("input[type=range]")) ||
          (!(event.metaKey || event.ctrlKey) &&
            event.code !== "Space" &&
            !!event.target.closest("button, a, summary, [role=button]")));
      const action = shortcutAction(event, shortcuts.value(), editing);
      if (!action) return;
      event.preventDefault();
      const player = library.player;
      if (action === "search") document.querySelector<HTMLInputElement>(".search input")?.focus();
      else if (action === "advanced") navigation.navigate("#/advanced-search");
      else if (action === "settings") navigation.navigate("#/settings");
      else if (action === "playback") navigation.navigate("#/playback");
      else if (action === "queue") {
        if (section() === "playback") window.dispatchEvent(new Event("phemios-queue-toggle"));
      } else if (
        action === "mute" ||
        action === "stop" ||
        action === "next" ||
        action === "previous"
      ) {
        void controlAudioShortcut(action, library);
      } else if (!player.busy()) {
        if (action === "toggle") {
          const reference = contextualReference(
            player.target(),
            Array.from(
              document.querySelectorAll<HTMLButtonElement>("main [data-play-reference]"),
            ).map((button) => ({
              reference: button.dataset.playReference ?? "",
              disabled: button.disabled,
              central: !!button.closest(".cover-flow-card.central"),
              visible: button.getClientRects().length > 0,
            })),
          );
          void toggleAudioShortcut(library, reference);
        }
      }
    }
    window.addEventListener("keydown", key);
    onCleanup(() => window.removeEventListener("keydown", key));
  });
  const [externalError, setExternalError] = createSignal("");
  const externalClick = (event: MouseEvent) => {
    const link = event.target instanceof Element ? event.target.closest("a[href]") : null;
    if (event.defaultPrevented || !link) return false;
    return activateExternalLink(
      {
        href: link.getAttribute("href") ?? "",
        button: event.button,
        preventDefault: () => event.preventDefault(),
      },
      isNative(),
      openExternalLink,
      setExternalError,
    );
  };
  const backLink = navigation.backLink;
  const [biographyReturn, setBiographyReturn] = createSignal<BiographyReturn>();
  const context = () =>
    artistCatalog(catalogSection()) && current().kind === "section"
      ? t("Initiale de l’artiste · année de ses albums")
      : t("Initiale du titre · année de l’album");
  const hasFilters = () => catalogRails(current());
  return (
    <div
      class="app"
      classList={{
        "sidebar-hidden": !sidebar(),
        "density-compact":
          current().kind !== "label" &&
          compact() &&
          !["favourites", "rated", "tags", "artists"].includes(section()),
      }}
      onContextMenu={(event) => event.preventDefault()}
      onAuxClick={externalClick}
      onClick={(event) => {
        if (externalClick(event)) return;
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
          <BrandWordmark />
        </a>
        <CatalogSearch
          section={current().kind === "section" ? section() : undefined}
          collection={
            !!(
              current().kind === "section" &&
              (current() as { collectionMenu?: string }).collectionMenu
            )
          }
          value={filters().query}
          onInput={(value) => {
            setFilters({ ...filters(), query: value });
            if (section() === "tags") {
              setSelectedTag([]);
              setTagOffset(0);
            }
          }}
        />
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
                    <p class="nav-label">{item.label}</p>
                  </Show>
                  <Show when={item.kind === "separator"}>
                    <div class="nav-spacer" aria-hidden="true" />
                  </Show>
                  <Show when={item.kind === "section" || item.kind === "collection"}>
                    <a
                      href={
                        isCollectionMenuId(item.id) ? collectionMenuHref(item.id) : `#/${item.id}`
                      }
                      aria-current={
                        (navigation.collectionMenu() ?? section()) === item.id ? "page" : undefined
                      }
                    >
                      <Icon name={item.symbol} />
                      <span>{item.label}</span>
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
              {principalArtists().length} {t("artistes d’album ·")}{" "}
              <AlbumCount value={library.albums().length} />
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
        <ParentalNotice />
        <Feedback message={externalError()} error onClose={() => setExternalError("")} />
        <Feedback message={browsing.error()} error />
        <Show
          when={needsCatalogPrompt(
            current(),
            library.artists().length,
            library.connected() || !!library.localSession(),
            library.busy(),
          )}
        >
          <div class="empty">
            <p>{t("Connectez votre serveur Aède pour synchroniser la bibliothèque.")}</p>
            <button class="primary" onClick={() => navigation.navigate("#/settings")}>
              {t("Configurer la connexion")}{" "}
            </button>
          </div>
        </Show>
        <StickyHeader shell>
          <Show when={hasFilters() && (library.artists().length || !!collectionTarget())}>
            <FilterBar
              resultCount={
                artistCatalog(catalogSection())
                  ? filterArtists(principalArtists(), library.albums(), filters()).length
                  : filterAlbums(
                      catalogSection() === "composers"
                        ? library.albums().filter((album) => album.composers?.length)
                        : catalogAlbums(),
                      library.artists(),
                      filters(),
                      filters().recentOnly ? recentNow() : 0,
                    ).filter((album) => catalogSection() !== "compilations" || album.compilation)
                      .length
              }
              value={filters()}
              setValue={setFilters}
              context={context()}
              yearDomain={yearDomain()}
              hasUnknownYear={catalogAlbums().some((album) => album.year === null)}
              histogram={distributions(
                current().kind === "section" && artistCatalog(catalogSection())
                  ? principalArtists()
                  : library.artists(),
                catalogSection() === "composers"
                  ? library.albums().filter((album) => album.composers?.length)
                  : catalogAlbums().filter(
                      (album) => catalogSection() !== "compilations" || album.compilation,
                    ),
                filters(),
                current().kind === "section" && artistCatalog(catalogSection()),
                filters().recentOnly ? recentNow() : 0,
              )}
              countLabel={
                current().kind === "section" && artistCatalog(catalogSection())
                  ? t("artistes")
                  : "albums"
              }
            />
          </Show>
          <Show
            when={
              (hasFilters() || backLink() || biographyReturn()) &&
              (library.artists().length || !!collectionTarget())
            }
          >
            <div class="catalog-tools">
              <Show
                when={biographyReturn()}
                fallback={
                  <Show when={backLink()}>
                    {(link) => (
                      <a
                        class="back"
                        href={link().href}
                        data-navigation-back
                        aria-label={t(
                          "Retour à {0}",
                          parseRoute(link().href).kind === "section"
                            ? t(link().label)
                            : link().label,
                        )}
                      >
                        <Icon name="back" />{" "}
                        {parseRoute(link().href).kind === "section"
                          ? t(link().label)
                          : link().label}
                      </a>
                    )}
                  </Show>
                }
              >
                {(destination) => (
                  <button
                    type="button"
                    class="back metadata-link"
                    aria-label={t("Retour à {0}", destination().label)}
                    onClick={destination().back}
                  >
                    <Icon name="back" />
                    {destination().label}
                  </button>
                )}
              </Show>
              <Show when={hasFilters() && catalogSection() === "albums"}>
                <RecentAlbumsFilter
                  active={!!filters().recentOnly}
                  onToggle={() => setFilters({ ...filters(), recentOnly: !filters().recentOnly })}
                />
              </Show>
              <Show
                when={
                  hasFilters() &&
                  ["albums", "compilations", "genres", "composers"].includes(catalogSection())
                }
              >
                <CoverSize
                  value={
                    browsing.value().coverSizes[
                      catalogSection() as "albums" | "compilations" | "genres" | "composers"
                    ] ?? browsing.value().coverSize
                  }
                  resetValue={browsing.value().coverSize}
                  disabled={!presentation.resizable()}
                  onChange={(value) =>
                    browsing.update({
                      coverSizes: { ...browsing.value().coverSizes, [catalogSection()]: value },
                    })
                  }
                />
              </Show>
              <span>{library.busy() ? t("Synchronisation…") : ""}</span>
              <Show when={hasFilters()}>
                <CatalogActions
                  presentations={
                    section() === "artists" ? (
                      <ArtistViewActions
                        value={browsing.value().artistView}
                        onChange={(artistView) => browsing.update({ artistView })}
                      />
                    ) : undefined
                  }
                  reverse={reverse()}
                  compact={compact()}
                  coverFlow={coverFlow()}
                  onReverse={() => setReverse(!reverse())}
                  onCompact={() => {
                    setCompact(supportsCoverFlow(catalogSection()) || !compact());
                  }}
                  onGrid={
                    supportsCoverFlow(catalogSection())
                      ? () => {
                          presentation.select("grid");
                        }
                      : undefined
                  }
                  onCoverFlow={
                    current().kind === "section" && supportsCoverFlow(catalogSection())
                      ? () => {
                          presentation.select("cover-flow");
                        }
                      : undefined
                  }
                >
                  <SelectionCollection
                    section={catalogSection() === "genres" ? "albums" : catalogSection()}
                    disabled={!!filters().recentOnly || !!collectionTarget()}
                    reason={
                      collectionTarget()
                        ? t("Gérez les critères de cette collection dans Collections.")
                        : filters().recentOnly
                          ? t(
                              "La création d’une collection depuis les ajouts récents n’est pas encore prise en charge.",
                            )
                          : undefined
                    }
                    filters={filters()}
                  />
                </CatalogActions>
              </Show>
            </div>
          </Show>
        </StickyHeader>
        <ConnectionNotice />
        <Show when={aedeDiagnostics.opened()}>
          <AedeDiagnosticDialog rows={aedeDiagnostics.rows()} onClose={aedeDiagnostics.close} />
        </Show>
        <Feedback error persistent message={library.error()} />
        <Show
          when={
            current().kind === "section" &&
            ![
              "artists",
              "albums",
              "compilations",
              "countries",
              "genres",
              "composers",
              "tracks",
              "tags",
              "labels",
              "radio",
              "concerts",
              "cd",
              "settings",
              "relations",
              "players",
            ].includes(section()) &&
            library.trackSources().length > 1
          }
        >
          <div class="choices library-source" aria-label={t("Origine des données personnelles")}>
            <For each={library.trackSources().map((row) => row.source)}>
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
        <Show when={pageRoute()} keyed>
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
              <Show
                when={parentalRouteAllowed(route, library.parental.available)}
                fallback={
                  <div class="page">
                    <EmptyState icon="lock">{t("Accès indisponible pour ce compte.")}</EmptyState>
                  </div>
                }
              >
                <Show when={route.kind === "section" && section() === "labels"}>
                  <LabelsPage query={filters().query} />
                </Show>
                <Show when={route.kind === "section" && section() !== "labels"}>
                  <Show
                    when={[
                      "artists",
                      "albums",
                      "compilations",
                      "countries",
                      "genres",
                      "composers",
                    ].includes(section())}
                    fallback={
                      <Show
                        when={section() === "tracks"}
                        fallback={
                          <Show
                            when={section() === "settings"}
                            fallback={
                              <Show
                                when={section() === "tags"}
                                fallback={
                                  <WorkspacePage
                                    collectionMenu={collectionTarget()}
                                    collectionRead={collectionRead}
                                    albumCatalog={albumCatalog}
                                    compact={compact()}
                                    section={section()}
                                    query={
                                      route.kind === "section" && route.collectionMenu
                                        ? filters().query
                                        : searchContext(section()).disabled
                                          ? ""
                                          : filters().query
                                    }
                                    onStatisticsBrowse={(selection) =>
                                      scopedFilters.select(selection.section, selection.filters)
                                    }
                                  />
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
                            <SettingsPage
                              menu={menu}
                              collectionChoices={collectionDirectory}
                              tab={
                                route.kind === "section" ? (route.tab ?? "libraries") : "libraries"
                              }
                            />
                          </Show>
                        }
                      >
                        <TracksPage
                          query={filters().query}
                          filters={filters()}
                          onFilters={(value) => {
                            setFilters(value);
                            trackPaging.setOffset(0);
                          }}
                          reverse={reverse()}
                          onReverse={() => {
                            setReverse(!reverse());
                            trackPaging.setOffset(0);
                          }}
                          yearDomain={yearDomain()}
                          size={browsing.value().trackPageSize}
                          setSize={(size) => browsing.update({ trackPageSize: size })}
                          preferenceError={browsing.error()}
                          offset={trackPaging.offset()}
                          setOffset={trackPaging.setOffset}
                        />
                      </Show>
                    }
                  >
                    <Show
                      when={section() === "albums"}
                      fallback={
                        <LibraryPage
                          artistView={browsing.value().artistView}
                          now={filters().recentOnly ? recentNow() : 0}
                          compact={compact()}
                          coverSize={
                            browsing.value().coverSizes[
                              section() as "albums" | "compilations" | "genres" | "composers"
                            ] ?? browsing.value().coverSize
                          }
                          section={section()}
                          filters={filters()}
                          setFilters={setFilters}
                          reverse={reverse()}
                          coverFlow={coverFlow()}
                          coverPosition={coverPosition}
                        />
                      }
                    >
                      <AlbumCatalog {...albumCatalog} />
                    </Show>
                  </Show>
                </Show>
                <Show when={route.kind === "artist"}>
                  <Show
                    when={selectedArtist()}
                    fallback={<p class="empty">{t("Artiste introuvable.")}</p>}
                  >
                    {(artist) => (
                      <ArtistPage
                        onBiographyNavigation={(value) => setBiographyReturn(value)}
                        artist={artist()}
                        onYear={browseAlbumYear}
                        compact={compact() && section() !== "artists"}
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
                        onYear={browseAlbumYear}
                      />
                    )}
                  </Show>
                </Show>
                <Show when={route.kind === "label"}>
                  <LabelPage
                    onBiographyNavigation={(value) => setBiographyReturn(value)}
                    reference={(route as { reference: string }).reference}
                    onTitle={setLabelTitle}
                    onYear={browseAlbumYear}
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
                  />
                </Show>
                <Show when={route.kind === "track"}>
                  <TrackPage
                    reference={(route as { reference: string }).reference}
                    onBrowse={(target) => {
                      scopedFilters.select(target.section, {
                        mode: target.year === undefined ? "none" : "years",
                        ...(target.year === undefined
                          ? {}
                          : { years: [target.year, target.year] as const }),
                        query: target.section === "genres" ? "" : target.query,
                        countries: [],
                        genre: undefined,
                        genres: target.section === "genres" ? [target.query] : [],
                        includeUnknownYear: target.year === undefined,
                      });
                      navigation.navigate(`#/${target.section}`);
                    }}
                  />
                </Show>
                <Show when={route.kind === "not-found"}>
                  <div class="empty">
                    <h1>{t("Page introuvable")}</h1>
                    <a href="#/artists">{t("Revenir aux artistes")}</a>
                  </div>
                </Show>
              </Show>
            </ErrorBoundary>
          )}
        </Show>
      </main>
      <Show
        when={footer() === "podcast"}
        fallback={
          <Show when={footer() === "radio"} fallback={<PlayerBar />}>
            <RadioPlayerBar />
          </Show>
        }
      >
        <PodcastPlayerBar />
      </Show>
    </div>
  );
}

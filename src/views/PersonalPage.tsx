import { QueueAppend } from "../components/QueueAppend";
import { CatalogActions } from "../components/CatalogActions";
import { CoverFlow } from "../components/CoverFlow";
import { createCoverPosition } from "../visualizer/cover-position";
import { readCollectionPlayback } from "../library/collection-playback";
import { Pagination } from "../components/Pagination";
import { ActivityGlyph } from "../components/ActivityGlyph";
import { PageLoader } from "../components/PageLoader";
import { CoverPlay } from "../components/CoverPlay";
import { historyTrackAction } from "../library/history-actions";
import { currentHistoryListen } from "../library/history-current";
import { AccountNotice } from "../components/AccountNotice";
import { collectionDuration } from "../library/detail-format";
import { StickyHeader } from "../components/StickyHeader";
import { Feedback } from "../components/Feedback";
import { ResultCount } from "../components/ResultCount";
import { ChoiceSelect } from "../components/ChoiceSelect";
import { Icon } from "../components/Icon";
import { RenameCollection } from "../components/RenameCollection";
import { SelectionCollection } from "../components/SelectionCollection";
import { personalCollectionExpression } from "../library/personal-collection";
import { DeleteCollection } from "../components/DeleteCollection";
import { EmptyState } from "../components/EmptyState";
import { locale } from "../i18n";
import { t } from "../i18n";
import { referenceSource } from "../library/sources";
import { createSignal, For, Show } from "solid-js";
import { HistoryReset } from "../components/HistoryReset";
import { CollectionAlbums } from "../components/CollectionAlbums";
import { useLibrary } from "../library/context";
import { normalizeName, filterAlbums } from "../library/filtering";
import { AlbumGrid } from "../components/AlbumGrid";
import { JobControls } from "../components/JobControls";
import { M3UExport, downloadM3U, type M3UFile } from "../components/M3UExport";
import { requestAede } from "../platform/desktop";
import { favouriteAlbums } from "../library/favourites";
import { createPersonalReads } from "../library/personal-reads";
import { createPersonalActions } from "../library/personal-actions";
import { createSavedCollection } from "../library/collection-save";
import { sectionIcon, type Section } from "../navigation/routes";
interface Collection {
  name: string;
  expression: string;
  duration_ms?: number;
}
interface Playlist {
  id: string;
  name: string;
  track_count: number;
  duplicates?: number;
}
/** Existing owner-scoped services, with explicit save and download actions. */
export function PersonalPage(props: { section: Section; query: string; catalogCompact: boolean }) {
  const library = useLibrary(),
    [editingCollection, setEditingCollection] = createSignal(false),
    [name, setName] = createSignal(""),
    [reverse, setReverse] = createSignal(false),
    [compact, setCompact] = createSignal(false),
    [flow, setFlow] = createSignal(false),
    [expression, setExpression] = createSignal(""),
    [selected, setSelected] = createSignal(""),
    [message, setMessage] = createSignal(""),
    [saving, setSaving] = createSignal(false),
    [playingCollection, setPlayingCollection] = createSignal(""),
    [openedCollection, setOpenedCollection] = createSignal(""),
    [offset, setOffset] = createSignal(0);
  const position = createCoverPosition();
  let nameInput: HTMLInputElement | undefined;
  const actions = createPersonalActions(
    () => props.section,
    library.session,
    library.source,
    () => {
      setOffset(0);
      setSelected("");
      setMessage("");
      setEditingCollection(false);
      setName("");
      setExpression("");
      setOpenedCollection("");
      setSaving(false);
      setPlayingCollection("");
    },
  );
  const reads = createPersonalReads(
    () => props.section,
    library.session,
    offset,
    (path, query, owner) => requestAede(path, query, "GET", null, library.source(), owner),
  );
  const page = () => reads.page()?.data;
  const history = reads.history;
  const listening = () =>
    currentHistoryListen({
      item: library.player.current(),
      owner: library.sessionFor(library.player.current()?.reference ?? ""),
      session: library.session(),
      status: library.player.state().status,
      offset: offset(),
    });
  const refetch = reads.refetch;
  const album = () => library.albums().find((item) => item.reference === selected());
  const matches = (value: string) => normalizeName(value).includes(normalizeName(props.query));
  async function save() {
    const session = library.session(),
      source = library.source();
    if (!session || session.account.role === "auditor" || saving()) return;
    const isCurrent = actions.capture();
    setSaving(true);
    setMessage("");
    try {
      await createSavedCollection(name(), expression(), isCurrent, source);
      if (!isCurrent()) return;
      setMessage(t("Collection enregistrée dans votre compte."));
      setName("");
      setExpression("");
      setEditingCollection(false);
      void refetch();
    } catch (failure) {
      if (isCurrent())
        setMessage(failure instanceof Error ? failure.message : t("Enregistrement impossible."));
    } finally {
      if (isCurrent()) setSaving(false);
    }
  }
  async function playCollection(name: string) {
    const session = library.session(),
      source = library.source(),
      admitted = actions.capture();
    if (
      !session ||
      session.account.role === "auditor" ||
      library.player.busy() ||
      playingCollection()
    )
      return;
    const epoch = library.trackSources().find((row) => row.source === source)?.scannedAt;
    setPlayingCollection(name);
    setMessage("");
    try {
      await library.player.readSelection(
        (current) =>
          readCollectionPlayback(
            name,
            source,
            session,
            library.albums(),
            epoch,
            () => admitted() && current(),
          ),
        source,
      );
    } catch (failure) {
      if (admitted())
        setMessage(failure instanceof Error ? failure.message : t("Lecture indisponible."));
    } finally {
      if (admitted()) setPlayingCollection("");
    }
  }
  async function download(id: string) {
    const isCurrent = actions.capture(),
      source = library.source();
    if (!isCurrent()) return;
    setMessage("");
    try {
      const file = await requestAede<M3UFile>(
        `/api/me/v1/m3u/${encodeURIComponent(id)}`,
        {},
        "GET",
        undefined,
        source,
      );
      if (!isCurrent()) return;
      const path = await downloadM3U(file);
      if (isCurrent()) setMessage(t("M3U téléchargé : {0}", path));
    } catch (failure) {
      if (isCurrent())
        setMessage(failure instanceof Error ? failure.message : t("Téléchargement impossible."));
    }
  }
  const favourites = () =>
    filterAlbums(
      favouriteAlbums(
        library.albums().filter((a) => referenceSource(a.reference) === library.source()),
        library.annotations,
      ),
      library.artists(),
      {
        mode: "alphabet",
        years: [0, 9999],
        alphabet: [0, 26],
        includeUnknownYear: true,
        query: props.query,
      },
    ).sort(
      (a, b) => normalizeName(a.title).localeCompare(normalizeName(b.title)) * (reverse() ? -1 : 1),
    );
  return (
    <section
      class="page result-page personal-page"
      classList={{ "history-page": props.section === "history" }}
    >
      <Show when={props.section === "favourites"}>
        <StickyHeader visible={!!library.session()}>
          <div class="personal-selection-actions">
            <ResultCount value={favourites().length} />
            <CatalogActions
              reverse={reverse()}
              compact={compact()}
              coverFlow={flow()}
              onReverse={() => setReverse(!reverse())}
              onCompact={() => {
                setFlow(false);
                setCompact(!compact());
              }}
              onCoverFlow={() => {
                setCompact(false);
                setFlow(!flow());
              }}
            >
              <SelectionCollection
                disabled={!favourites().length}
                expression={personalCollectionExpression("favourites", props.query)}
              />
            </CatalogActions>
          </div>
        </StickyHeader>
        <AccountNotice connected={!!library.session()} />
        <Show
          when={favourites().length}
          fallback={
            <EmptyState icon={sectionIcon(props.section)}>
              {t("Aucun album favori dans cette sélection.")}
            </EmptyState>
          }
        >
          <div
            class="personal-albums"
            classList={{ "density-compact": compact(), "personal-flow": flow() }}
          >
            <Show when={flow()} fallback={<AlbumGrid albums={favourites()} compact={compact()} />}>
              <CoverFlow albums={favourites()} position={position} reverse={reverse()} />
            </Show>
          </div>
        </Show>
      </Show>
      <Show when={props.section === "collections"}>
        <StickyHeader visible={!!library.session()}>
          <div class="personal-selection-actions">
            <button
              class="icon-button collection-create"
              title={t("Créer une collection")}
              aria-label={t("Créer une collection")}
              aria-expanded={editingCollection()}
              aria-controls="collection-editor"
              disabled={!library.session() || library.session()?.account.role === "auditor"}
              onClick={() => {
                if (saving()) return;
                const open = !editingCollection();
                setEditingCollection(open);
                if (open) queueMicrotask(() => nameInput?.focus());
              }}
            >
              <Icon name="library" />
            </button>
          </div>
        </StickyHeader>
        <AccountNotice connected={!!library.session()} />
        <Show when={editingCollection()}>
          <form
            id="collection-editor"
            class="collection-form"
            onSubmit={(event) => {
              event.preventDefault();
              void save();
            }}
          >
            <label>
              {t("Nom de la collection")}{" "}
              <input
                ref={(element) => {
                  nameInput = element;
                }}
                required
                value={name()}
                onInput={(event) => setName(event.currentTarget.value)}
              />
            </label>
            <label>
              {t("Règle Aède")}{" "}
              <input
                required
                value={expression()}
                placeholder="genre:Jazz"
                onInput={(event) => setExpression(event.currentTarget.value)}
              />
            </label>
            <small>{t("La règle est validée et enregistrée par le moteur Aède.")}</small>
            <div class="annotation-edit-actions">
              <button
                class="primary"
                disabled={
                  !library.session() || library.session()?.account.role === "auditor" || saving()
                }
              >
                {t("Enregistrer la collection")}{" "}
              </button>
              <button
                type="button"
                class="quiet"
                disabled={saving()}
                onClick={() => setEditingCollection(false)}
              >
                {t("Annuler")}
              </button>
            </div>
          </form>
        </Show>
        <ul class="personal-list">
          <For
            each={(page()?.items as Collection[] | undefined)?.filter((row) =>
              matches(`${row.name} ${row.expression}`),
            )}
          >
            {(row) => (
              <li class="collection-row">
                <RenameCollection
                  name={row.name}
                  onRenamed={(name) => {
                    if (openedCollection() === row.name) setOpenedCollection(name);
                    void refetch();
                  }}
                />
                <span class="collection-duration" title={t("Durée totale")}>
                  {collectionDuration(row.duration_ms)}
                </span>
                <button
                  type="button"
                  class="icon-button quiet"
                  aria-label={
                    openedCollection() === row.name ? t("Masquer les albums") : t("Voir les albums")
                  }
                  title={
                    openedCollection() === row.name ? t("Masquer les albums") : t("Voir les albums")
                  }
                  aria-pressed={openedCollection() === row.name}
                  onClick={() =>
                    setOpenedCollection(openedCollection() === row.name ? "" : row.name)
                  }
                >
                  <Icon name={openedCollection() === row.name ? "eye" : "eye-off"} />
                </button>
                <DeleteCollection
                  name={row.name}
                  onDeleted={() => {
                    if (openedCollection() === row.name) setOpenedCollection("");
                    void refetch();
                  }}
                />
                <QueueAppend
                  reference={`track:@phemios/${library.source()}/queue`}
                  title={row.name}
                  disabled={!!playingCollection()}
                  load={(current) => {
                    const session = library.session(),
                      source = library.source(),
                      admitted = actions.capture();
                    if (!session) throw new Error(t("Lecture indisponible."));
                    return readCollectionPlayback(
                      row.name,
                      source,
                      session,
                      library.albums(),
                      library.trackSources().find((entry) => entry.source === source)?.scannedAt,
                      () => admitted() && current(),
                    );
                  }}
                />
                <button
                  type="button"
                  class="icon-button quiet"
                  aria-label={t("Lire {0}", row.name)}
                  title={t("Lire {0}", row.name)}
                  aria-busy={playingCollection() === row.name || undefined}
                  disabled={
                    !library.player.canStart(`track:@phemios/${library.source()}/queue`) ||
                    library.player.busy() ||
                    !!playingCollection()
                  }
                  onClick={() => void playCollection(row.name)}
                >
                  <Show when={playingCollection() === row.name} fallback={<Icon name="play" />}>
                    <ActivityGlyph />
                  </Show>
                </button>
              </li>
            )}
          </For>
        </ul>
      </Show>
      <Show when={props.section === "collections" && openedCollection()}>
        <CollectionAlbums name={openedCollection()} compact={props.catalogCompact} />
      </Show>
      <Show when={props.section === "analysis" || props.section === "playlists"}>
        <label class="album-selection">
          {t("Album")}{" "}
          <ChoiceSelect
            label={t("Choisissez un album")}
            value={selected()}
            onChange={setSelected}
            options={[
              { value: "", label: t("Choisissez un album") },
              ...library.albums().map((album) => ({
                value: album.reference,
                label:
                  album.title +
                  " · " +
                  (library.artists().find((artist) => artist.reference === album.artist)?.name ??
                    t("Artistes divers")),
              })),
            ]}
          />
        </label>
        <Show when={album()}>
          {(value) => (
            <Show
              when={props.section === "analysis"}
              fallback={<M3UExport release={value().reference} title={value().title} />}
            >
              <JobControls release={value().reference} />
            </Show>
          )}
        </Show>
      </Show>
      <Show when={props.section === "playlists"}>
        <p class="muted">
          {t(
            "Listes déjà enregistrées sur Aède : téléchargez-les pour un autre lecteur. Les réenregistrements identiques sont regroupés.",
          )}
        </p>
        <ul class="personal-list">
          <For each={(page()?.items as Playlist[] | undefined)?.filter((row) => matches(row.name))}>
            {(row) => (
              <li>
                <strong>{row.name}</strong>
                <small>
                  {row.track_count} {t("pistes")}
                  <Show when={(row.duplicates ?? 1) > 1}>
                    {" "}
                    · {t("{0} enregistrements identiques", row.duplicates)}
                  </Show>
                </small>
                <button onClick={() => download(row.id)}>{t("Télécharger le M3U")}</button>
              </li>
            )}
          </For>
        </ul>
      </Show>
      <Show when={props.section === "history"}>
        <StickyHeader
          visible={!!library.session()}
          separator={(page()?.total ?? 0) > 0 || !!listening()}
        >
          <div class="personal-selection-actions history-selection-actions">
            <Show when={(page()?.total ?? 0) > 0}>
              <div class="history-reset">
                <HistoryReset
                  onReset={() => {
                    setOffset(0);
                    void refetch();
                  }}
                />
              </div>
            </Show>
          </div>
        </StickyHeader>
        <div class="history-results">
          <AccountNotice connected={!!library.session()} />
          <Show when={listening()}>
            {(row) => (
              <div class="history-current">
                <Icon name={library.player.state().status === "playing" ? "volume" : "pause"} />
                <div>
                  <small>{t("Écoute en cours")}</small>
                  <a href={`#/track/${encodeURIComponent(row().reference)}`}>{row().title}</a>
                  <small>
                    {row().artist} · {row().album?.title}
                  </small>
                </div>
              </div>
            )}
          </Show>
          <ul class="personal-list">
            <For
              each={history()?.filter((row) =>
                matches(`${row.title} ${new Date(row.at * 1000).toLocaleString(locale())}`),
              )}
            >
              {(row) => (
                <li class="history-row">
                  <a href={historyTrackAction(row).href} title={row.title}>
                    {row.title}
                  </a>
                  <div class="history-visit">
                    <small>
                      {new Date(row.at * 1000).toLocaleString(locale())} ·{" "}
                      {row.ms_played === null
                        ? t("Durée inconnue")
                        : t("{0} s écoutées", Math.round(row.ms_played / 1000))}
                    </small>
                    <Show when={row.error}>
                      <small>{row.error}</small>
                    </Show>
                  </div>
                  <CoverPlay
                    reference={historyTrackAction(row).reference}
                    title={row.title}
                    disabled={historyTrackAction(row).disabled}
                    class="history-play"
                    append
                  />
                </li>
              )}
            </For>
          </ul>
        </div>
      </Show>
      <Show when={reads.loading() && !reads.page()}>
        <PageLoader />
      </Show>
      <Show when={reads.page()?.error}>
        <p role="alert">{reads.page()?.error}</p>
      </Show>
      <Show
        when={
          (!library.session() && ["collections", "history"].includes(props.section)) ||
          (page() && !page()?.items.length && (props.section !== "history" || !listening()))
        }
      >
        <EmptyState icon={sectionIcon(props.section)}>
          {t("Aucun élément enregistré dans cette rubrique.")}
        </EmptyState>
      </Show>
      <Show when={(page()?.total ?? 0) > 50}>
        <Pagination
          offset={offset()}
          size={50}
          total={page()?.total ?? 0}
          count={page()?.items.length ?? 0}
          busy={reads.loading()}
          onOffset={setOffset}
        />
      </Show>
      <Feedback message={message()} />
    </section>
  );
}

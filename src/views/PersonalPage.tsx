import { currentHistoryListen } from "../library/history-current";
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
import { createEffect, createSignal, For, Show } from "solid-js";
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
import { sectionIcon, type Section } from "../navigation/routes";
interface Collection {
  name: string;
  expression: string;
}
interface Playlist {
  id: string;
  name: string;
  track_count: number;
  duplicates?: number;
}
/** Existing owner-scoped services, with explicit save and download actions. */
export function PersonalPage(props: { section: Section; query: string }) {
  const library = useLibrary(),
    [editingCollection, setEditingCollection] = createSignal(false),
    [name, setName] = createSignal(""),
    [expression, setExpression] = createSignal(""),
    [selected, setSelected] = createSignal(""),
    [message, setMessage] = createSignal(""),
    [saving, setSaving] = createSignal(false),
    [offset, setOffset] = createSignal(0);
  let nameInput: HTMLInputElement | undefined;
  createEffect(() => {
    void props.section;
    void library.source();
    setOffset(0);
    setSelected("");
    setMessage("");
    setEditingCollection(false);
  });
  const reads = createPersonalReads(
    () => props.section,
    library.session,
    offset,
    (path, query) => requestAede(path, query),
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
  const [openedCollection, setOpenedCollection] = createSignal("");
  const album = () => library.albums().find((item) => item.reference === selected());
  const matches = (value: string) => normalizeName(value).includes(normalizeName(props.query));
  async function save() {
    const session = library.session(),
      source = library.source();
    if (!session || session.account.role === "auditor") return;
    setSaving(true);
    setMessage("");
    try {
      await requestAede(
        "/api/me/v1/collection",
        { name: name() },
        "PUT",
        {
          expression: expression(),
        },
        source,
      );
      if (session !== library.session() || source !== library.source()) return;
      setMessage(t("Collection enregistrée dans votre compte."));
      setName("");
      setExpression("");
      setEditingCollection(false);
      void refetch();
    } catch (failure) {
      setMessage(failure instanceof Error ? failure.message : t("Enregistrement impossible."));
    } finally {
      setSaving(false);
    }
  }
  async function download(id: string) {
    setMessage("");
    try {
      const file = await requestAede<M3UFile>(`/api/me/v1/m3u/${encodeURIComponent(id)}`);
      setMessage(t("M3U téléchargé : {0}", await downloadM3U(file)));
    } catch (failure) {
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
    );
  return (
    <section class="page personal-page">
      <Show when={!library.session() && !library.demo}>
        <p class="notice">{t("Connectez-vous pour accéder aux données de votre compte.")}</p>
      </Show>
      <Show when={props.section === "favourites"}>
        <StickyHeader>
          <div class="personal-selection-actions">
            <ResultCount value={favourites().length} />
            <SelectionCollection
              disabled={!favourites().length}
              expression={personalCollectionExpression("favourites", props.query)}
            />
          </div>
        </StickyHeader>
        <Show
          when={favourites().length}
          fallback={
            <EmptyState icon={sectionIcon(props.section)}>
              {t("Aucun album favori dans cette sélection.")}
            </EmptyState>
          }
        >
          <AlbumGrid albums={favourites()} />
        </Show>
      </Show>
      <Show when={props.section === "collections"}>
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
              <li>
                <RenameCollection
                  name={row.name}
                  onRenamed={(name) => {
                    if (openedCollection() === row.name) setOpenedCollection(name);
                    void refetch();
                  }}
                />
                <button onClick={() => setOpenedCollection(row.name)}>
                  {t("Voir les albums")}
                </button>
                <DeleteCollection
                  name={row.name}
                  onDeleted={() => {
                    if (openedCollection() === row.name) setOpenedCollection("");
                    void refetch();
                  }}
                />
              </li>
            )}
          </For>
        </ul>
      </Show>
      <Show when={props.section === "collections" && openedCollection()}>
        <CollectionAlbums name={openedCollection()} />
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
        <ul class="personal-list">
          <For
            each={history()?.filter((row) =>
              matches(`${row.title} ${new Date(row.at * 1000).toLocaleString(locale())}`),
            )}
          >
            {(row) => (
              <li>
                <Show when={row.release} fallback={<strong>{row.title}</strong>}>
                  {(ref) => <a href={`#/album/${encodeURIComponent(ref())}`}>{row.title}</a>}
                </Show>
                <small>
                  {new Date(row.at * 1000).toLocaleString(locale())} ·{" "}
                  {row.ms_played === null
                    ? t("Durée inconnue")
                    : t("{0} s écoutées", Math.round(row.ms_played / 1000))}
                </small>
                <Show when={"error" in row}>
                  <small>{row.error}</small>
                </Show>
              </li>
            )}
          </For>
        </ul>
      </Show>
      <Show when={reads.loading()}>
        <p role="status">{t("Chargement…")}</p>
      </Show>
      <Show when={reads.page()?.error}>
        <p role="alert">{reads.page()?.error}</p>
      </Show>
      <Show when={page() && !page()?.items.length && (props.section !== "history" || !listening())}>
        <EmptyState icon={sectionIcon(props.section)}>
          {t("Aucun élément enregistré dans cette rubrique.")}
        </EmptyState>
      </Show>
      <Show when={(page()?.total ?? 0) > 50}>
        <div class="choices">
          <button
            disabled={!offset()}
            onClick={() => setOffset((value) => Math.max(0, value - 50))}
          >
            {t("Précédent")}{" "}
          </button>
          <span>
            {offset() + 1} / {page()?.total}
          </span>
          <button
            disabled={offset() + 50 >= (page()?.total ?? 0)}
            onClick={() => setOffset((value) => value + 50)}
          >
            {t("Suivant")}{" "}
          </button>
        </div>
      </Show>
      <Feedback message={message()} />
    </section>
  );
}

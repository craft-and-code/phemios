import { createEffect, createResource, createSignal, For, Show } from "solid-js";
import { useLibrary } from "../library/context";
import { normalizeName, filterAlbums } from "../library/filtering";
import { AlbumGrid } from "../components/AlbumGrid";
import { JobControls } from "../components/JobControls";
import { M3UExport, downloadM3U, type M3UFile } from "../components/M3UExport";
import { requestAede } from "../platform/desktop";
import type { Section } from "../navigation/routes";
interface Collection {
  name: string;
  expression: string;
}
interface Playlist {
  id: string;
  name: string;
  track_count: number;
}
interface Play {
  track: string;
  at: number;
  ms_played: number | null;
  completed: boolean | null;
}
interface Page {
  items: unknown[];
  total: number;
}
/** Existing owner-scoped services, with explicit save and download actions. */
export function PersonalPage(props: { section: Section; query: string }) {
  const library = useLibrary(),
    [name, setName] = createSignal(""),
    [expression, setExpression] = createSignal(""),
    [selected, setSelected] = createSignal(""),
    [message, setMessage] = createSignal(""),
    [saving, setSaving] = createSignal(false),
    [offset, setOffset] = createSignal(0);
  createEffect(() => {
    void props.section;
    setOffset(0);
    setSelected("");
    setMessage("");
  });
  const path = () =>
    ({
      collections: "/api/me/v1/collections",
      history: "/api/me/v1/history",
      playlists: "/api/me/v1/m3u",
    })[props.section as "collections" | "history" | "playlists"];
  const [page, { refetch }] = createResource(
    () => (library.session() && path() ? { path: path(), offset: offset() } : false),
    async (input) => requestAede<Page>(input.path, { offset: String(input.offset), limit: "50" }),
  );
  const [history] = createResource(
    () => (props.section === "history" ? page() : undefined),
    async (value) => {
      const rows = value.items as Play[];
      const result: (Play & { title: string; release: string | null; error?: string })[] = [];
      for (const row of rows) {
        try {
          const track = await requestAede<{ title: string; release: string | null }>(
            "/api/v1/track",
            { ref: row.track },
          );
          result.push({ ...row, ...track });
        } catch (failure) {
          result.push({
            ...row,
            title: "Piste indisponible",
            release: null,
            error: String(failure),
          });
        }
      }
      return result;
    },
  );
  const album = () => library.albums().find((item) => item.reference === selected());
  const matches = (value: string) => normalizeName(value).includes(normalizeName(props.query));
  async function save() {
    setSaving(true);
    setMessage("");
    try {
      await requestAede("/api/me/v1/collection", { name: name() }, "PUT", {
        expression: expression(),
      });
      setMessage("Collection enregistrée dans votre compte.");
      setName("");
      setExpression("");
      void refetch();
    } catch (failure) {
      setMessage(failure instanceof Error ? failure.message : "Enregistrement impossible.");
    } finally {
      setSaving(false);
    }
  }
  async function download(id: string) {
    setMessage("");
    try {
      const file = await requestAede<M3UFile>(`/api/me/v1/m3u/${encodeURIComponent(id)}`);
      setMessage(`M3U téléchargé : ${await downloadM3U(file)}`);
    } catch (failure) {
      setMessage(failure instanceof Error ? failure.message : "Téléchargement impossible.");
    }
  }
  const favourites = () =>
    filterAlbums(library.albums(), library.artists(), {
      mode: "alphabet",
      years: [0, 9999],
      alphabet: [0, 26],
      includeUnknownYear: true,
      query: props.query,
    }).filter((album) => library.annotations[album.reference]?.loved);
  return (
    <section class="page personal-page">
      <Show when={!library.session() && !library.demo}>
        <p class="notice">Connectez-vous pour accéder aux données de votre compte.</p>
      </Show>
      <Show when={props.section === "favourites"}>
        <AlbumGrid albums={favourites()} />
        <div class="choices">
          <For
            each={library
              .artists()
              .filter(
                (artist) => library.annotations[artist.reference]?.loved && matches(artist.name),
              )}
          >
            {(artist) => (
              <a class="favourite-artist" href={`#/artist/${encodeURIComponent(artist.reference)}`}>
                ♥ {artist.name}
              </a>
            )}
          </For>
        </div>
      </Show>
      <Show when={props.section === "collections"}>
        <form
          class="collection-form"
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <label>
            Nom de la collection
            <input
              required
              value={name()}
              onInput={(event) => setName(event.currentTarget.value)}
            />
          </label>
          <label>
            Règle Aède
            <input
              required
              value={expression()}
              placeholder="genre:Jazz"
              onInput={(event) => setExpression(event.currentTarget.value)}
            />
          </label>
          <small>La règle est validée et enregistrée par le moteur Aède.</small>
          <button
            class="primary"
            disabled={
              !library.session() || library.session()?.account.role === "auditor" || saving()
            }
          >
            Enregistrer la collection
          </button>
        </form>
        <ul class="personal-list">
          <For
            each={(page()?.items as Collection[] | undefined)?.filter((row) =>
              matches(`${row.name} ${row.expression}`),
            )}
          >
            {(row) => (
              <li>
                <strong>{row.name}</strong>
                <code>{row.expression}</code>
                <button
                  onClick={() => {
                    setName(row.name);
                    setExpression(row.expression);
                  }}
                >
                  Modifier
                </button>
              </li>
            )}
          </For>
        </ul>
      </Show>
      <Show when={props.section === "analysis" || props.section === "playlists"}>
        <label class="album-selection">
          Album
          <select value={selected()} onChange={(event) => setSelected(event.currentTarget.value)}>
            <option value="">Choisissez un album</option>
            <For each={library.albums()}>
              {(album) => (
                <option value={album.reference}>
                  {album.title} ·{" "}
                  {library.artists().find((artist) => artist.reference === album.artist)?.name ??
                    "Artistes divers"}
                </option>
              )}
            </For>
          </select>
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
        <ul class="personal-list">
          <For each={(page()?.items as Playlist[] | undefined)?.filter((row) => matches(row.name))}>
            {(row) => (
              <li>
                <strong>{row.name}</strong>
                <small>{row.track_count} pistes</small>
                <button onClick={() => download(row.id)}>Télécharger le M3U</button>
              </li>
            )}
          </For>
        </ul>
      </Show>
      <Show when={props.section === "history"}>
        <p class="muted">
          Historique confirmé par Aède ; aucun événement d’écoute n’est inventé par cette vue.
        </p>
        <ul class="personal-list">
          <For
            each={history()?.filter((row) =>
              matches(`${row.title} ${new Date(row.at * 1000).toLocaleString("fr-FR")}`),
            )}
          >
            {(row) => (
              <li>
                <Show when={row.release} fallback={<strong>{row.title}</strong>}>
                  {(ref) => <a href={`#/album/${encodeURIComponent(ref())}`}>{row.title}</a>}
                </Show>
                <small>
                  {new Date(row.at * 1000).toLocaleString("fr-FR")} ·{" "}
                  {row.ms_played === null
                    ? "Durée inconnue"
                    : `${Math.round(row.ms_played / 1000)} s écoutées`}
                </small>
                <Show when={"error" in row}>
                  <small>{row.error}</small>
                </Show>
              </li>
            )}
          </For>
        </ul>
      </Show>
      <Show when={page.loading || history.loading}>
        <p role="status">Chargement…</p>
      </Show>
      <Show when={page.error || history.error}>
        <p role="alert">{String(page.error ?? history.error)}</p>
      </Show>
      <Show when={page() && !page()?.items.length}>
        <p class="empty">Aucun élément enregistré dans cette rubrique.</p>
      </Show>
      <Show when={(page()?.total ?? 0) > 50}>
        <div class="choices">
          <button
            disabled={!offset()}
            onClick={() => setOffset((value) => Math.max(0, value - 50))}
          >
            Précédent
          </button>
          <span>
            {offset() + 1} / {page()?.total}
          </span>
          <button
            disabled={offset() + 50 >= (page()?.total ?? 0)}
            onClick={() => setOffset((value) => value + 50)}
          >
            Suivant
          </button>
        </div>
      </Show>
      <p role="status">{message()}</p>
    </section>
  );
}

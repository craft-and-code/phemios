import { createEffect, createResource, createSignal, For, Show, on } from "solid-js";
import { Artwork } from "../components/Artwork";
import { JobControls } from "../components/JobControls";
import { M3UExport } from "../components/M3UExport";
import { useLibrary } from "../library/context";
import { requestAede } from "../platform/desktop";
import type { Annotation, Track } from "../library/server";
import type { Album } from "../library/types";
interface AvailableTrack extends Track {
  spectrum_available: boolean;
}
/** Read/edit current-account annotations; save failure never discards the draft. */
export function AlbumPage(props: { album: Album }) {
  const library = useLibrary();
  const artist = () => library.artists().find((item) => item.reference === props.album.artist);
  const [rating, setRating] = createSignal<number | null>(null),
    [favourite, setFavourite] = createSignal(false),
    [tags, setTags] = createSignal(""),
    [note, setNote] = createSignal(""),
    [saving, setSaving] = createSignal(false),
    [message, setMessage] = createSignal("");
  const [annotation, { refetch: refetchAnnotation, mutate: mutateAnnotation }] = createResource(
    () => (library.session() ? props.album.reference : false),
    (ref) => requestAede<{ annotation: Annotation | null }>("/api/me/v1/annotation", { ref }),
  );
  createEffect(
    on(annotation, (answer) => {
      if (annotation.loading || annotation.error) return;
      const saved = answer?.annotation;
      setRating(saved?.rating ?? null);
      setFavourite(saved?.loved ?? false);
      setTags(saved?.tags.join(", ") ?? "");
      setNote(saved?.note ?? "");
      if (saved) library.updateAnnotation(props.album.reference, saved);
    }),
  );
  const [tracks, { refetch }] = createResource(
    () => (library.session() ? props.album.reference : false),
    async (ref) => {
      const album = await requestAede<{ tracks: string[] }>("/api/v1/album", { ref });
      const rows: AvailableTrack[] = [];
      for (const ref of album.tracks)
        rows.push(await requestAede<AvailableTrack>("/api/v1/track", { ref }));
      return rows;
    },
  );
  const completed = () => library.tasks.jobs().filter((job) => job.status === "completed").length;
  let lastCompleted = completed();
  createEffect(() => {
    const count = completed();
    if (count > lastCompleted) {
      lastCompleted = count;
      void refetch();
    }
  });
  async function save() {
    setSaving(true);
    setMessage("");
    const account = library.session()?.account.id;
    const reference = props.album.reference;
    try {
      const answer = await requestAede<{ annotation: Annotation | null }>(
        "/api/me/v1/annotation",
        { ref: reference },
        "PUT",
        {
          loved: favourite(),
          rating: rating(),
          note: note() || null,
          tags: [
            ...new Set(
              tags()
                .split(",")
                .map((value) => value.trim())
                .filter(Boolean),
            ),
          ],
        },
      );
      if (account === library.session()?.account.id) {
        library.updateAnnotation(reference, answer.annotation);
        if (reference === props.album.reference) {
          mutateAnnotation(answer);
          setMessage("Enregistré dans votre compte Aède.");
        }
      }
    } catch (failure) {
      setMessage(failure instanceof Error ? failure.message : "Enregistrement impossible.");
    } finally {
      setSaving(false);
    }
  }
  return (
    <article class="page album-page">
      <a
        class="back"
        href={
          props.album.artist ? `#/artist/${encodeURIComponent(props.album.artist)}` : "#/albums"
        }
      >
        ← {artist()?.name ?? "Tous les albums"}
      </a>
      <div class="album-hero">
        <Artwork album={props.album} />
        <div>
          <p class="eyebrow">{props.album.compilation ? "COMPILATION" : "ALBUM"}</p>
          <h1>{props.album.title}</h1>
          <p>
            {artist()?.name ?? "Artistes divers"} · {props.album.year ?? "Année inconnue"}
          </p>
          <button class="primary" disabled>
            Lecture native à raccorder
          </button>
          <M3UExport release={props.album.reference} title={props.album.title} />
        </div>
      </div>
      <section class="annotation-panel">
        <h2>Votre regard sur cet album</h2>
        <Show when={!library.session()}>
          <p class="notice">Connectez-vous pour enregistrer vos annotations.</p>
        </Show>
        <Show when={annotation.error}>
          <p role="alert">Annotations illisibles : {String(annotation.error)}</p>
          <button onClick={() => refetchAnnotation()}>Réessayer les annotations</button>
        </Show>
        <div class="annotation-controls">
          <fieldset
            disabled={
              !library.session() ||
              !!annotation.error ||
              annotation.loading ||
              library.session()?.account.role === "auditor"
            }
          >
            <legend>Note personnelle</legend>
            <div class="stars">
              <For each={[1, 2, 3, 4, 5]}>
                {(value) => (
                  <button
                    aria-label={`${value} étoile(s)`}
                    aria-pressed={rating() === value}
                    classList={{ selected: value <= (rating() ?? 0) }}
                    onClick={() => setRating(rating() === value ? null : value)}
                  >
                    ★
                  </button>
                )}
              </For>
            </div>
          </fieldset>
          <button
            disabled={
              !library.session() ||
              library.session()?.account.role === "auditor" ||
              annotation.loading ||
              !!annotation.error
            }
            aria-pressed={favourite()}
            onClick={() => setFavourite(!favourite())}
          >
            {favourite() ? "♥ Favori" : "♡ Ajouter aux favoris"}
          </button>
        </div>
        <label>
          Tags
          <input
            disabled={
              !library.session() ||
              !!annotation.error ||
              annotation.loading ||
              library.session()?.account.role === "auditor"
            }
            value={tags()}
            onInput={(event) => setTags(event.currentTarget.value)}
            placeholder="Séparez les tags par des virgules"
          />
        </label>
        <label>
          Notes personnelles
          <textarea
            disabled={
              !library.session() ||
              !!annotation.error ||
              annotation.loading ||
              library.session()?.account.role === "auditor"
            }
            value={note()}
            onInput={(event) => setNote(event.currentTarget.value)}
            rows="4"
            placeholder="Une impression, un souvenir, une recommandation…"
          />
        </label>
        <button
          class="primary"
          disabled={
            !library.session() ||
            library.session()?.account.role === "auditor" ||
            annotation.loading ||
            !!annotation.error ||
            saving()
          }
          onClick={save}
        >
          Enregistrer mes annotations
        </button>
        <p role="status">{message()}</p>
      </section>
      <section>
        <h2>Pistes, analyses et spectres</h2>
        <JobControls release={props.album.reference} />
        <Show when={tracks.error}>
          <p role="alert">Pistes indisponibles : {String(tracks.error)}</p>
        </Show>
        <Show when={tracks.loading}>
          <p class="muted">Chargement des pistes…</p>
        </Show>
        <ol class="track-list">
          <For each={tracks()}>
            {(track) => (
              <li>
                <div class="track-heading">
                  <strong>{track.title}</strong>
                  <small>
                    {track.duration_ms === null
                      ? "Durée inconnue"
                      : `${Math.floor(track.duration_ms / 60000)}:${String(Math.floor(track.duration_ms / 1000) % 60).padStart(2, "0")}`}
                  </small>
                  <Show when={track.spectrum_available}>
                    <button onClick={() => library.warmImage(track.reference, "spectrum")}>
                      Afficher le spectre
                    </button>
                  </Show>
                </div>
                <Show when={track.analyses.length}>
                  <details>
                    <summary>Analyse FlacCompagnon disponible</summary>
                    <pre>{JSON.stringify(track.analyses, null, 2)}</pre>
                  </details>
                </Show>
                <Show when={library.image(track.reference, "spectrum")}>
                  {(url) => <img class="spectrum" src={url()} alt={`Spectre de ${track.title}`} />}
                </Show>
                <Show when={library.imageError(track.reference, "spectrum")}>
                  <p role="alert">{library.imageError(track.reference, "spectrum")}</p>
                </Show>
              </li>
            )}
          </For>
        </ol>
      </section>
    </article>
  );
}

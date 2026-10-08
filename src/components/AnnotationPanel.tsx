import { createEffect, createResource, createSignal, For, Show, on } from "solid-js";
import { useLibrary } from "../library/context";
import { requestAede } from "../platform/desktop";
import type { Annotation } from "../library/server";
import { NoteEditor } from "./NoteEditor";
import { Icon } from "./Icon";
/** Shared current-owner artist/album drafts; writes happen only on explicit save. */
export function AnnotationPanel(props: { reference: string }) {
  const library = useLibrary();
  const [editorUnavailable, setEditorUnavailable] = createSignal(true);
  const [rating, setRating] = createSignal<number | null>(null),
    [favourite, setFavourite] = createSignal(false),
    [tags, setTags] = createSignal(""),
    [note, setNote] = createSignal(""),
    [saving, setSaving] = createSignal(false),
    [message, setMessage] = createSignal("");
  let readNote = () => note();
  const [annotation, { refetch: refetchAnnotation, mutate: mutateAnnotation }] = createResource(
    () => (library.session() ? props.reference : false),
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
      if (saved) library.updateAnnotation(props.reference, saved);
    }),
  );
  async function save() {
    setSaving(true);
    setMessage("");
    const account = library.session()?.account.id;
    const reference = props.reference;
    const currentNote = readNote();
    try {
      const answer = await requestAede<{ annotation: Annotation | null }>(
        "/api/me/v1/annotation",
        { ref: reference },
        "PUT",
        {
          loved: favourite(),
          rating: rating(),
          note: currentNote || null,
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
        if (reference === props.reference) {
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
  const blocked = () =>
    !library.session() ||
    library.session()?.account.role === "auditor" ||
    annotation.loading ||
    !!annotation.error;
  return (
    <section class="annotation-panel">
      <h2>Vos annotations</h2>
      <Show when={!library.session()}>
        <p class="notice">Connectez-vous pour enregistrer vos annotations.</p>
      </Show>
      <Show when={annotation.error}>
        <p role="alert">Annotations illisibles : {String(annotation.error)}</p>
        <button onClick={() => refetchAnnotation()}>Réessayer les annotations</button>
      </Show>
      <div class="annotation-controls">
        <fieldset
          aria-label="Note personnelle"
          disabled={
            !library.session() ||
            !!annotation.error ||
            annotation.loading ||
            library.session()?.account.role === "auditor"
          }
        >
          <div class="stars">
            <For each={[1, 2, 3, 4, 5]}>
              {(value) => (
                <button
                  aria-label={`${value} étoile(s)`}
                  aria-pressed={rating() === value}
                  classList={{ selected: value <= (rating() ?? 0) }}
                  onClick={() => setRating(rating() === value ? null : value)}
                >
                  <Icon name="star" />
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
          class="annotation-heart"
          aria-label={favourite() ? "Retirer des favoris" : "Ajouter aux favoris"}
          title={favourite() ? "Retirer des favoris" : "Ajouter aux favoris"}
          aria-pressed={favourite()}
          onClick={() => setFavourite(!favourite())}
        >
          <Icon name="heart" />
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
      <div class="annotation-note">
        <p>Notes personnelles</p>
        <NoteEditor
          value={note()}
          disabled={blocked()}
          onChange={setNote}
          onUnavailable={setEditorUnavailable}
          onRead={(read) => {
            readNote = read;
          }}
        />
      </div>
      <button
        class="primary"
        disabled={
          !library.session() ||
          library.session()?.account.role === "auditor" ||
          annotation.loading ||
          !!annotation.error ||
          saving() ||
          editorUnavailable()
        }
        onClick={save}
      >
        Enregistrer mes annotations
      </button>
      <p role="status">{message()}</p>
    </section>
  );
}

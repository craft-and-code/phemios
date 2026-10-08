import {
  createEffect,
  createMemo,
  createResource,
  createSignal,
  For,
  Show,
  on,
  onCleanup,
} from "solid-js";
import { useLibrary } from "../library/context";
import { annotationScope } from "../library/annotation-scope";
import { annotationWriter, type AnnotationPatch } from "../library/annotation-writes";
import { requestAede } from "../platform/desktop";
import type { Annotation } from "../library/server";
import { TagInput } from "./TagInput";
import { tagVocabulary } from "../library/tags";
import { NoteEditor } from "./NoteEditor";
import { Icon } from "./Icon";
/** Icons save their own fields immediately; notes/tags stay in an explicit draft. */
export function AnnotationPanel(props: { reference: string; kind: "artist" | "album" | "track" }) {
  const library = useLibrary();
  const [editorUnavailable, setEditorUnavailable] = createSignal(true);
  const [rating, setRating] = createSignal<number | null>(null),
    [favourite, setFavourite] = createSignal(false),
    [tags, setTags] = createSignal<string[]>([]),
    [pendingTag, setPendingTag] = createSignal(false),
    [note, setNote] = createSignal(""),
    [pending, setPending] = createSignal(0),
    [savingNotes, setSavingNotes] = createSignal(false),
    [savedNote, setSavedNote] = createSignal(""),
    [savedTags, setSavedTags] = createSignal<string[]>([]),
    [message, setMessage] = createSignal(""),
    [failure, setFailure] = createSignal("");
  let readTags = () => tags(),
    readNote = () => note(),
    disposed = false;
  const revisions = { rating: 0, loved: 0 };
  onCleanup(() => {
    disposed = true;
  });
  const scope = annotationScope(() => props.reference, library.session);
  const writer = createMemo(() => {
    const { session, reference } = scope();
    const current = () => !disposed && writer() === controller;
    const controller = annotationWriter({
      active: () => !!session && session === library.session(),
      request: async (patch) =>
        (
          await requestAede<{ annotation: Annotation | null }>(
            "/api/me/v1/annotation",
            { ref: reference },
            "PUT",
            patch,
          )
        ).annotation,
      publish: (saved) => library.updateAnnotation(reference, saved),
      pending: (count) => {
        if (current()) setPending(count);
      },
    });
    return controller;
  });
  const [annotation, { refetch }] = createResource(
    () => (scope().session ? scope() : false),
    (scope) =>
      requestAede<{ annotation: Annotation | null }>("/api/me/v1/annotation", {
        ref: scope.reference,
      }),
  );
  createEffect(
    on(annotation, (answer) => {
      if (annotation.loading || annotation.error) return;
      const saved = answer?.annotation;
      setRating(saved?.rating ?? null);
      setFavourite(saved?.loved ?? false);
      setTags(saved?.tags.slice() ?? []);
      setNote(saved?.note ?? "");
      setSavedNote(note());
      setSavedTags(tags());
      setMessage("");
      setFailure("");
      setPending(0);
      setSavingNotes(false);
      if (saved) library.updateAnnotation(props.reference, saved);
    }),
  );
  const current = (held: ReturnType<typeof annotationWriter>) => !disposed && held === writer();
  async function quickSave(field: "rating" | "loved", value: number | boolean | null) {
    const held = writer(),
      revision = ++revisions[field];
    setMessage("");
    setFailure("");
    try {
      await held.write({ [field]: value } as AnnotationPatch);
      if (current(held))
        setMessage(
          `Étoiles et favori de ${props.kind === "artist" ? "cet artiste" : props.kind === "track" ? "ce titre" : "cet album"} enregistrés dans Aède.`,
        );
    } catch (error) {
      if (!current(held)) return;
      if (revision === revisions[field]) {
        const saved = library.annotations[props.reference];
        if (field === "rating") setRating(saved?.rating ?? null);
        else setFavourite(saved?.loved ?? false);
      }
      setFailure(error instanceof Error ? error.message : "Enregistrement impossible.");
    }
  }
  async function saveNotes() {
    const held = writer(),
      currentNote = readNote(),
      currentTags = readTags();
    setSavingNotes(true);
    setMessage("");
    setFailure("");
    try {
      await held.write({
        note: currentNote || null,
        tags: currentTags,
      });
      if (current(held)) {
        setSavedNote(currentNote);
        setSavedTags(currentTags);
        setMessage("Notes et tags enregistrés dans votre compte Aède.");
      }
    } catch (error) {
      if (current(held))
        setFailure(error instanceof Error ? error.message : "Enregistrement impossible.");
    } finally {
      if (current(held)) setSavingNotes(false);
    }
  }
  const blocked = () =>
    !library.session() ||
    library.session()?.account.role === "auditor" ||
    annotation.loading ||
    !!annotation.error;
  const dirty = () =>
    note() !== savedNote() ||
    pendingTag() ||
    JSON.stringify(tags()) !== JSON.stringify(savedTags());
  return (
    <section class="annotation-panel">
      <h2>
        Annotations de{" "}
        {props.kind === "artist" ? "l’artiste" : props.kind === "track" ? "la piste" : "l’album"}
      </h2>
      <Show when={!library.session()}>
        <p class="notice">Connectez-vous pour enregistrer vos annotations.</p>
      </Show>
      <Show when={annotation.error}>
        <p role="alert">Annotations illisibles : {String(annotation.error)}</p>
        <button onClick={() => refetch()}>Réessayer les annotations</button>
      </Show>
      <div class="annotation-controls">
        <fieldset aria-label="Note personnelle" disabled={blocked()}>
          <div class="stars">
            <For each={[1, 2, 3, 4, 5]}>
              {(value) => (
                <button
                  aria-label={`${value} étoile(s)`}
                  aria-pressed={rating() === value}
                  classList={{ selected: value <= (rating() ?? 0) }}
                  onClick={() => {
                    const selected = rating() === value ? null : value;
                    setRating(selected);
                    void quickSave("rating", selected);
                  }}
                >
                  <Icon name="star" />
                </button>
              )}
            </For>
          </div>
        </fieldset>
        <button
          disabled={blocked()}
          class="annotation-heart"
          aria-label={favourite() ? "Retirer des favoris" : "Ajouter aux favoris"}
          title={favourite() ? "Retirer des favoris" : "Ajouter aux favoris"}
          aria-pressed={favourite()}
          onClick={() => {
            const selected = !favourite();
            setFavourite(selected);
            void quickSave("loved", selected);
          }}
        >
          <Icon name="heart" />
        </button>
      </div>
      <TagInput
        value={tags()}
        vocabulary={tagVocabulary(Object.values(library.annotations))}
        disabled={blocked()}
        resetKey={`${library.session()?.account.id ?? ""}:${props.reference}`}
        onChange={(value) => {
          setTags(value);
          setMessage("");
        }}
        onPending={setPendingTag}
        onRead={(read) => {
          readTags = read;
        }}
      />
      <div class="annotation-note">
        <p>Notes personnelles</p>
        <NoteEditor
          value={note()}
          disabled={blocked()}
          onChange={(value) => {
            setNote(value);
            setMessage("");
          }}
          onUnavailable={setEditorUnavailable}
          onRead={(read) => {
            readNote = read;
          }}
        />
      </div>
      <button
        class="primary"
        disabled={blocked() || savingNotes() || editorUnavailable()}
        onClick={saveNotes}
      >
        Enregistrer les notes et tags
      </button>
      <p role="status">
        {pending()
          ? "Enregistrement dans Aède…"
          : dirty()
            ? "Notes et tags non enregistrés."
            : message()}
      </p>
      <Show when={failure()}>
        <p role="alert">{failure()} Les notes en cours sont conservées.</p>
      </Show>
    </section>
  );
}

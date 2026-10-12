import { Feedback } from "./Feedback";
import { normalizeName } from "../library/filtering";
import { suggestionVocabulary } from "../library/tag-preferences";
import { referenceSource } from "../library/sources";
import { StarRating } from "./StarRating";
import { t } from "../i18n";
import { createEffect, createMemo, createSignal, For, Show, on, onCleanup } from "solid-js";
import { useLibrary } from "../library/context";
import { createAnnotationRead } from "../library/annotation-read";
import { annotationWriter, type AnnotationPatch } from "../library/annotation-writes";
import { requestAede } from "../platform/desktop";
import { TagInput } from "./TagInput";
import { tagVocabulary } from "../library/tags";
import { NoteEditor } from "./NoteEditor";
import { Icon } from "./Icon";
/** Icons save their own fields immediately; notes/tags stay in an explicit draft. */
export function AnnotationPanel(props: { reference: string; kind: "artist" | "album" | "track" }) {
  const library = useLibrary();
  const [editing, setEditing] = createSignal(false);
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
    disposed = false,
    enteredTags: string[] = [];
  const revisions = { rating: 0, loved: 0 };
  onCleanup(() => {
    disposed = true;
  });
  const read = createAnnotationRead(
    () => props.reference,
    () => library.sessionFor(props.reference),
    (reference) => requestAede("/api/me/v1/annotation", { ref: reference }),
  );
  const scope = read.scope;
  const writer = createMemo(() => {
    const { session, reference } = scope();
    const current = () => !disposed && writer() === controller;
    const controller = annotationWriter({
      reference,
      active: () => !!session && session === library.sessionFor(props.reference),
      request: (patch) => requestAede("/api/me/v1/annotation", { ref: reference }, "PUT", patch),
      publish: (saved) => library.updateAnnotation(reference, saved),
      pending: (count) => {
        if (current()) setPending(count);
      },
    });
    return controller;
  });
  createEffect(
    on(scope, () => {
      setRating(null);
      setFavourite(false);
      setTags([]);
      setNote("");
      setSavedNote("");
      setSavedTags([]);
      setMessage("");
      setFailure("");
      setPending(0);
      setSavingNotes(false);
      setPendingTag(false);
      setEditing(false);
      setEditorUnavailable(true);
      enteredTags = [];
      readTags = () => tags();
      readNote = () => note();
    }),
  );
  createEffect(
    on(read.current, (saved) => {
      if (saved === undefined || read.loading() || read.error()) return;
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
      setEditing(false);
      library.updateAnnotation(props.reference, saved);
    }),
  );
  createEffect(() => {
    const saved = library.annotations[props.reference];
    if (!pending()) setFavourite(saved?.loved ?? false);
  });
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
          t(
            "Étoiles et favori de {0} enregistrés dans Aède.",
            props.kind === "artist"
              ? t("cet artiste")
              : props.kind === "track"
                ? t("ce titre")
                : t("cet album"),
          ),
        );
    } catch (error) {
      if (!current(held)) return;
      if (revision === revisions[field]) {
        const saved = library.annotations[props.reference];
        if (field === "rating") setRating(saved?.rating ?? null);
        else setFavourite(saved?.loved ?? false);
      }
      setFailure(error instanceof Error ? error.message : t("Enregistrement impossible."));
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
        const session = library.sessionFor(props.reference);
        if (session && enteredTags.length)
          library.tagPreferences.remember(
            session,
            enteredTags.filter((tag) =>
              currentTags.some((value) => normalizeName(value) === normalizeName(tag)),
            ),
            referenceSource(props.reference),
          );
        setMessage(t("Notes et tags enregistrés dans votre compte Aède."));
        setEditing(false);
      }
    } catch (error) {
      if (current(held))
        setFailure(error instanceof Error ? error.message : t("Enregistrement impossible."));
    } finally {
      if (current(held)) setSavingNotes(false);
    }
  }
  const blocked = () =>
    !library.sessionFor(props.reference) ||
    library.sessionFor(props.reference)?.account.role === "auditor" ||
    read.loading() ||
    !!read.error();
  const dirty = () =>
    note() !== savedNote() ||
    pendingTag() ||
    JSON.stringify(tags()) !== JSON.stringify(savedTags());
  return (
    <section class="annotation-panel">
      <h2>
        {t("Annotations de")}{" "}
        {props.kind === "artist"
          ? t("l’artiste")
          : props.kind === "track"
            ? t("la piste")
            : t("l’album")}
      </h2>
      <Show when={!library.sessionFor(props.reference)}>
        <p class="notice">{t("Connectez-vous pour enregistrer vos annotations.")}</p>
      </Show>
      <Show when={read.error()}>
        <p role="alert">
          {t("Annotations illisibles :")} {String(read.error())}
        </p>
        <button onClick={() => read.refetch()}>{t("Réessayer les annotations")}</button>
      </Show>
      <div class="annotation-controls">
        <fieldset aria-label={t("Note personnelle")} disabled={blocked()}>
          <StarRating
            value={rating()}
            label={t("Note personnelle")}
            onChange={(selected) => {
              setRating(selected);
              void quickSave("rating", selected);
            }}
          />
        </fieldset>
        <button
          disabled={blocked()}
          class="annotation-heart"
          aria-label={favourite() ? t("Retirer des favoris") : t("Ajouter aux favoris")}
          title={favourite() ? t("Retirer des favoris") : t("Ajouter aux favoris")}
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
      <div class="section-heading annotation-text-heading">
        <h3>{t("Tags et notes personnelles")}</h3>
        <Show when={!editing()}>
          <button
            class="icon-button quiet"
            disabled={blocked()}
            aria-label={t("Modifier les tags et notes")}
            title={t("Modifier les tags et notes")}
            onClick={() => {
              enteredTags = [];
              setEditorUnavailable(true);
              setEditing(true);
            }}
          >
            <Icon name="edit" />
          </button>
        </Show>
      </div>
      <Show
        when={editing()}
        fallback={
          <div class="annotation-reading">
            <div class="tag-pills" aria-label={t("Tags enregistrés")}>
              <Show
                when={savedTags().length}
                fallback={<p class="muted">{t("Aucun tag personnel.")}</p>}
              >
                <For each={savedTags()}>{(tag) => <span class="tag-pill">{tag}</span>}</For>
              </Show>
            </div>
            <Show
              when={savedNote()}
              fallback={<p class="muted">{t("Aucune note personnelle.")}</p>}
            >
              <NoteEditor
                value={savedNote()}
                disabled
                viewOnly
                onChange={() => {}}
                onUnavailable={() => {}}
                onRead={() => {}}
              />
            </Show>
          </div>
        }
      >
        <TagInput
          autofocus
          onEntered={(value) => {
            enteredTags.push(...value);
          }}
          value={tags()}
          vocabulary={suggestionVocabulary(
            tagVocabulary(
              Object.values(library.annotations).filter(
                (row) => row && referenceSource(row.reference) === referenceSource(props.reference),
              ),
            ),
            library.tagPreferences.entries(),
            library.sessionFor(props.reference),
            referenceSource(props.reference),
          )}
          disabled={blocked()}
          resetKey={`${library.sessionFor(props.reference)?.account.id ?? ""}:${props.reference}`}
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
          <p>{t("Notes personnelles")}</p>
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
        <div class="annotation-edit-actions">
          <button
            class="primary"
            disabled={blocked() || savingNotes() || editorUnavailable()}
            onClick={saveNotes}
          >
            {t("Enregistrer les notes et tags")}{" "}
          </button>
          <button
            class="quiet"
            disabled={savingNotes()}
            onClick={() => {
              setTags(savedTags().slice());
              setNote(savedNote());
              setPendingTag(false);
              setFailure("");
              setEditing(false);
            }}
          >
            {t("Annuler")}{" "}
          </button>
        </div>
      </Show>
      <Show when={library.tagPreferences.error()}>
        <p role="alert">{library.tagPreferences.error()}</p>
      </Show>
      <Show
        when={pending() || dirty()}
        fallback={<Feedback message={message()} onClose={() => setMessage("")} />}
      >
        <p role="status">
          {pending() ? t("Enregistrement dans Aède…") : t("Notes et tags non enregistrés.")}
        </p>
      </Show>
      <Show when={failure()}>
        <p role="alert">
          {failure()} {t("Les notes en cours sont conservées.")}
        </p>
      </Show>
    </section>
  );
}

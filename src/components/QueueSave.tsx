import { DownloadButton } from "./DownloadButton";
import { createEffect, createMemo, createSignal, on, onMount, onCleanup, Show } from "solid-js";
import { createExportState } from "../library/export-state";
import { t } from "../i18n";
import { useLibrary } from "../library/context";
import { requestAede } from "../platform/desktop";
import { referenceSource } from "../library/sources";
import { queueExpression } from "../library/advanced-search";
import { SelectionCollection } from "./SelectionCollection";
import { downloadM3U, type M3UFile } from "./M3UExport";
import { Feedback } from "./Feedback";
import { Icon } from "./Icon";
/** Collections retain membership; explicit M3U publication freezes order and occurrences. */
export function QueueSave() {
  const library = useLibrary(),
    player = library.player,
    [draft, setDraft] = createSignal<readonly string[]>(),
    [name, setName] = createSignal("");
  const references = () => player.queue().map((row) => row.reference);
  const first = () => references()[0] ?? "";
  const source = () => referenceSource(first());
  const writable = () =>
    !!first() && ["user", "admin"].includes(library.sessionFor(first())?.account.role ?? "");
  const scope = createMemo(
    () => ({ source: source(), session: first() ? library.sessionFor(first()) : undefined }),
    undefined,
    { equals: (a, b) => a.source === b.source && a.session === b.session },
  );
  const state = createExportState<ReturnType<typeof scope>, M3UFile>(scope);
  const busy = state.busy,
    message = state.message,
    failure = state.failed,
    file = state.file;
  const downloadIdentity = createMemo(() => ({ scope: scope(), file: file() }));
  let draftScope: ReturnType<typeof scope> | undefined;
  createEffect(
    on(scope, () => {
      setDraft(undefined);
      setName("");
      draftScope = undefined;
    }),
  );
  async function save() {
    const tracks = draft(),
      held = draftScope;
    if (!tracks || !held || held !== scope() || !held.session) return;
    const action = state.begin();
    if (!action) return;
    try {
      const status = await requestAede<{ capabilities: string[] }>(
        "/api/v1/status",
        {},
        "GET",
        null,
        held.source,
      );
      if (!action.current()) return;
      if (!status.capabilities?.includes("queue_m3u"))
        throw new Error(
          t("Mettez à jour puis redémarrez Aède pour enregistrer cette liste de lecture."),
        );
      const saved = await requestAede<M3UFile>(
        "/api/me/v1/m3u",
        {},
        "POST",
        { name: name(), tracks },
        held.source,
        held.session,
      );
      if (!action.current()) return;
      if (
        !saved?.id?.startsWith("playlist-") ||
        typeof saved.name !== "string" ||
        typeof saved.content !== "string" ||
        typeof saved.filename !== "string"
      )
        throw new Error(t("Publication M3U non confirmée par Aède."));
      action.file({ ...saved, source: held.source });
      setDraft(undefined);
      action.feedback(t("M3U enregistré sur Aède."));
    } catch (error) {
      action.feedback(String(error), true);
    } finally {
      action.finish();
    }
  }
  async function download(saved: M3UFile) {
    if (!scope().session || file() !== saved) return false;
    const action = state.begin();
    if (!action) return false;
    try {
      const path = await downloadM3U(saved);
      if (!action.current()) return false;
      action.feedback(t("M3U téléchargé : {0}", path));
      return true;
    } catch (error) {
      action.feedback(String(error), true);
      return false;
    } finally {
      action.finish();
    }
  }
  return (
    <>
      <SelectionCollection
        expression={queueExpression(
          references().map((ref) => ref.replace(/:@phemios\/(local|server)\//, ":")),
        )}
        source={source()}
        disabled={!references().length}
      />
      <button
        class="icon-button quiet"
        aria-label={t("Créer un M3U depuis la liste de lecture")}
        title={t("Créer un M3U depuis la liste de lecture")}
        disabled={!writable() || busy()}
        onClick={(_draft) => {
          draftScope = scope();
          setDraft([...references()]);
          setName(t("Liste de lecture"));
          state.dismiss();
        }}
      >
        <Icon name="playlist" />
      </button>
      <Show when={file()}>
        {(saved) => (
          <DownloadButton
            label={t("Télécharger le M3U")}
            identity={downloadIdentity()}
            disabled={busy() || !scope().session}
            onClick={() => download(saved())}
          />
        )}
      </Show>
      <Show when={message()}>
        <div class="queue-save-feedback">
          <Feedback message={message()} error={failure()} onClose={state.dismiss} />
        </div>
      </Show>
      <Show when={draft()}>
        {(_draft) => {
          let dialog: HTMLDialogElement | undefined;
          onMount(() => dialog?.showModal());
          onCleanup(() => dialog?.close());
          return (
            <dialog
              ref={(element) => {
                dialog = element;
              }}
              class="collection-dialog"
              aria-label={t("Créer un M3U")}
              onCancel={(event) => {
                event.preventDefault();
                if (!busy()) setDraft(undefined);
              }}
              onClick={(event) => {
                if (event.target === event.currentTarget && !busy()) setDraft(undefined);
              }}
            >
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  void save();
                }}
              >
                <div class="section-heading">
                  <h2>{t("Créer un M3U")}</h2>
                  <button
                    type="button"
                    class="icon-button quiet icon-close"
                    aria-label={t("Fermer")}
                    disabled={busy()}
                    onClick={() => setDraft(undefined)}
                  >
                    <Icon name="close" />
                  </button>
                </div>
                <div class="collection-name-row">
                  <label>
                    {t("Nom")}
                    <input
                      autofocus
                      required
                      maxlength="128"
                      value={name()}
                      onInput={(event) => setName(event.currentTarget.value)}
                    />
                  </label>
                  <button class="primary" disabled={busy()}>
                    <Show when={busy()}>
                      <span class="spinner" />
                    </Show>
                    {t("Enregistrer")}
                  </button>
                </div>
                <Feedback message={message()} error={failure()} />
              </form>
            </dialog>
          );
        }}
      </Show>
    </>
  );
}

import { createSignal, onMount, onCleanup, Show } from "solid-js";
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
    [name, setName] = createSignal(""),
    [busy, setBusy] = createSignal(false),
    [message, setMessage] = createSignal(""),
    [file, setFile] = createSignal<M3UFile>(),
    [failure, setFailure] = createSignal(false);
  const references = () => player.queue().map((row) => row.reference);
  const first = () => references()[0] ?? "";
  const source = () => referenceSource(first());
  const writable = () =>
    !!first() && ["user", "admin"].includes(library.sessionFor(first())?.account.role ?? "");
  let owner: ReturnType<typeof library.session>,
    heldSource = source();
  async function save() {
    const tracks = draft();
    if (!tracks || busy()) return;
    setBusy(true);
    setMessage("");
    setFailure(false);
    const current = () => owner === library.sessionFor(tracks[0]!);
    try {
      const status = await requestAede<{ capabilities: string[] }>(
        "/api/v1/status",
        {},
        "GET",
        null,
        heldSource,
      );
      if (!current()) return;
      if (!status.capabilities?.includes("queue_m3u"))
        throw new Error(
          t("Mettez à jour puis redémarrez Aède pour enregistrer cette liste de lecture."),
        );
      const saved = await requestAede<M3UFile>(
        "/api/me/v1/m3u",
        {},
        "POST",
        { name: name(), tracks },
        heldSource,
      );
      if (!current()) return;
      if (
        !saved?.id?.startsWith("playlist-") ||
        typeof saved.content !== "string" ||
        typeof saved.filename !== "string"
      )
        throw new Error(t("Publication M3U non confirmée par Aède."));
      setFile({ ...saved, source: heldSource });
      setDraft(undefined);
      setMessage(t("M3U enregistré sur Aède."));
    } catch (error) {
      if (current()) {
        setMessage(String(error));
        setFailure(true);
      }
    } finally {
      setBusy(false);
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
          owner = library.sessionFor(first());
          heldSource = source();
          setDraft([...references()]);
          setName(t("Liste de lecture"));
          setMessage("");
        }}
      >
        <Icon name="playlist" />
      </button>
      <Show when={file()}>
        {(saved) => (
          <button
            class="icon-button quiet"
            aria-label={t("Télécharger le M3U")}
            title={t("Télécharger le M3U")}
            disabled={busy() || library.sessionFor(first()) !== owner}
            onClick={async () => {
              setBusy(true);
              try {
                setFailure(false);
                setMessage(t("M3U téléchargé : {0}", await downloadM3U(saved())));
              } catch (error) {
                setFailure(true);
                setMessage(String(error));
              } finally {
                setBusy(false);
              }
            }}
          >
            <Icon name="download" />
          </button>
        )}
      </Show>
      <Show when={message()}>
        <div class="queue-save-feedback">
          <Feedback message={message()} error={failure()} onClose={() => setMessage("")} />
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

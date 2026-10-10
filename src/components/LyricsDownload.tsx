import { Feedback } from "./Feedback";
import { createSignal, Show } from "solid-js";
import { t } from "../i18n";
import { requestAede } from "../platform/desktop";
import { useLibrary } from "../library/context";
import { referenceSource } from "../library/sources";
import { Icon } from "./Icon";
/** Explicit LRCLIB acquisition delegates exact-track scope and sidecar preservation to Aède. */
export function LyricsDownload(props: { reference: string }) {
  const library = useLibrary(),
    [busy, setBusy] = createSignal(false),
    [error, setError] = createSignal("");
  const job = () =>
    library.tasks
      .jobs()
      .slice()
      .reverse()
      .find(
        (row) =>
          row.release === props.reference &&
          row.kind === "lyrics" &&
          row.source === referenceSource(props.reference),
      );
  const active = () => busy() || ["queued", "running"].includes(job()?.status ?? "");
  async function fetchWords() {
    setBusy(true);
    setError("");
    try {
      const source = referenceSource(props.reference),
        session = library.sessionFor(props.reference);
      const info = await requestAede<{ capabilities?: string[] }>(
        "/api/v1/status",
        {},
        "GET",
        null,
        source,
      );
      if (!info.capabilities?.includes("fetch_track_lyrics"))
        throw new Error(t("Mettez à jour puis redémarrez Aède pour télécharger les paroles."));
      if (!session || session !== library.sessionFor(props.reference))
        throw new Error(t("Session invalide."));
      await library.tasks.start("lyrics", props.reference, false);
    } catch (failure) {
      setError(String(failure));
    } finally {
      setBusy(false);
    }
  }
  return (
    <span class="lyrics-action">
      <button
        class="icon-button quiet"
        aria-label={t("Télécharger les paroles")}
        title={t("Télécharger les paroles · LRCLIB, sans clé API")}
        disabled={
          active() ||
          library.sessionFor(props.reference)?.account.role !== "admin" ||
          !library.sessionFor(props.reference)?.server.startsWith("http://")
        }
        aria-busy={active()}
        onClick={() => void fetchWords()}
      >
        <Show when={active()} fallback={<Icon name="lyrics-download" />}>
          <span class="spinner" />
        </Show>
      </button>
      <Show when={error()}>
        <Feedback
          class="lyrics-action-result"
          error
          message={error()}
          onClose={() => setError("")}
        />
      </Show>
      <Show when={job() && !active()}>
        <Feedback
          class="lyrics-action-result"
          error={job()?.status !== "completed"}
          message={
            job()?.status === "completed"
              ? job()?.result?.stdout || t("Tâche terminée.")
              : job()?.error?.message || job()?.result?.stderr || t("Téléchargement impossible.")
          }
        />
      </Show>
    </span>
  );
}

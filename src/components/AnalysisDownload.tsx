import { Feedback } from "./Feedback";
import { t } from "../i18n";
import { createSignal, Show } from "solid-js";
import { downloadAnalysisAede } from "../platform/desktop";
import { Icon } from "./Icon";
import { useLibrary } from "../library/context";
/** Export comes from Aède; no user-selected filesystem path enters the native bridge. */
export function AnalysisDownload(props: {
  reference: string;
  album?: boolean;
  available: boolean;
  onStatus?: (message: string, failure: boolean) => void;
}) {
  const library = useLibrary();
  const [busy, setBusy] = createSignal(false),
    [path, setPath] = createSignal(""),
    [failure, setFailure] = createSignal("");
  async function download() {
    const reference = props.reference,
      session = library.sessionFor(reference);
    const current = () =>
      reference === props.reference && session === library.sessionFor(reference);
    setBusy(true);
    setFailure("");
    setPath("");
    try {
      const saved = await downloadAnalysisAede(reference);
      if (current()) {
        if (props.onStatus) props.onStatus(`${t("Enregistré :")} ${saved}`, false);
        else setPath(saved);
      }
    } catch (error) {
      if (current()) {
        const message = error instanceof Error ? error.message : t("Téléchargement impossible.");
        if (props.onStatus) props.onStatus(message, true);
        else setFailure(message);
      }
    } finally {
      setBusy(false);
    }
  }
  return (
    <div class="analysis-download">
      <button
        class="icon-button quiet"
        disabled={!library.sessionFor(props.reference) || !props.available || busy()}
        onClick={download}
        aria-busy={busy()}
        aria-label={
          busy()
            ? t("Téléchargement du rapport…")
            : t("Télécharger le JSON {0}", props.album ? t("de l’album") : t("du titre"))
        }
        title={t("Télécharger le JSON {0}", props.album ? t("de l’album") : t("du titre"))}
      >
        <Show when={busy()} fallback={<Icon name="download" />}>
          <span class="spinner" aria-hidden="true" />
        </Show>
      </button>
      <Show when={path()}>
        <Feedback message={t("Enregistré :") + " " + path()} onClose={() => setPath("")} />
      </Show>
      <Show when={failure()}>
        <Feedback
          error
          message={
            failure() +
            " " +
            t("Un rapport complet et actuel est nécessaire ; relancez l’analyse si besoin.")
          }
          onClose={() => setFailure("")}
        />
      </Show>
    </div>
  );
}

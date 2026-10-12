import { Feedback } from "./Feedback";
import { DownloadButton } from "./DownloadButton";
import { t } from "../i18n";
import { createMemo, createSignal, createEffect, on } from "solid-js";
import { downloadAnalysisAede } from "../platform/desktop";
import { useLibrary } from "../library/context";
/** Server-authored reports acknowledge only their exact captured reference and owner. */
export function AnalysisDownload(props: {
  reference: string;
  album?: boolean;
  available: boolean;
  onStatus?: (message: string, failure: boolean) => void;
}) {
  const library = useLibrary(),
    scope = createMemo(() => ({
      reference: props.reference,
      session: library.sessionFor(props.reference),
    }));
  const [message, setMessage] = createSignal(""),
    [failed, setFailed] = createSignal(false);
  createEffect(on(scope, () => setMessage("")));
  function publish(message: string, error: boolean) {
    if (props.onStatus) props.onStatus(message, error);
    else {
      setMessage(message);
      setFailed(error);
    }
  }
  async function download() {
    const held = scope();
    try {
      const path = await downloadAnalysisAede(held.reference);
      if (scope() !== held) return false;
      publish(t("Enregistré :") + " " + path, false);
      return true;
    } catch (error) {
      if (scope() === held)
        publish(
          (error instanceof Error ? error.message : t("Téléchargement impossible.")) +
            " " +
            t("Un rapport complet et actuel est nécessaire ; relancez l’analyse si besoin."),
          true,
        );
      return false;
    }
  }
  return (
    <div class="analysis-download">
      <DownloadButton
        identity={scope()}
        disabled={!scope().session || !props.available}
        label={t("Télécharger le JSON {0}", props.album ? t("de l’album") : t("du titre"))}
        onClick={download}
      />
      <Feedback message={message()} error={failed()} onClose={() => setMessage("")} />
    </div>
  );
}

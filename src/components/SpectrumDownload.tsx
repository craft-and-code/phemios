import { Feedback } from "./Feedback";
import { DownloadButton } from "./DownloadButton";
import { t } from "../i18n";
import { createMemo, createSignal, createEffect, on } from "solid-js";
import { downloadSpectrumAede } from "../platform/desktop";
import { useLibrary } from "../library/context";
/** Explicit confirmed spectrum export never starts an analysis job. */
export function SpectrumDownload(props: { reference: string }) {
  const library = useLibrary(),
    scope = createMemo(() => ({
      reference: props.reference,
      session: library.sessionFor(props.reference),
    }));
  const [message, setMessage] = createSignal(""),
    [failed, setFailed] = createSignal(false);
  createEffect(on(scope, () => setMessage("")));
  async function download() {
    const held = scope();
    try {
      const path = await downloadSpectrumAede(held.reference);
      if (scope() !== held) return false;
      setFailed(false);
      setMessage(t("Spectre téléchargé : {0}", path));
      return true;
    } catch (error) {
      if (scope() === held) {
        setFailed(true);
        setMessage(error instanceof Error ? error.message : t("Téléchargement impossible."));
      }
      return false;
    }
  }
  return (
    <div class="analysis-download">
      <DownloadButton
        identity={scope()}
        disabled={!scope().session}
        label={t("Télécharger le spectre")}
        onClick={download}
      />
      <Feedback message={message()} error={failed()} onClose={() => setMessage("")} />
    </div>
  );
}

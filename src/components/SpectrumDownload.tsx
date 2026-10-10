import { Feedback } from "./Feedback";
import { t } from "../i18n";
import { createSignal, Show } from "solid-js";
import { downloadSpectrumAede } from "../platform/desktop";
import { useLibrary } from "../library/context";
import { Icon } from "./Icon";
/** Explicit export uses the server-selected saved image, never an analysis job. */
export function SpectrumDownload(props: { reference: string }) {
  const library = useLibrary(),
    [busy, setBusy] = createSignal(false),
    [message, setMessage] = createSignal("");
  async function download() {
    setBusy(true);
    setMessage("");
    try {
      setMessage(t("Spectre téléchargé : {0}", await downloadSpectrumAede(props.reference)));
    } catch (e) {
      setMessage(e instanceof Error ? e.message : t("Téléchargement impossible."));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div class="analysis-download">
      <button
        class="icon-button quiet"
        title={t("Télécharger le spectre")}
        aria-label={t("Télécharger le spectre")}
        disabled={!library.sessionFor(props.reference) || busy()}
        onClick={() => void download()}
      >
        <Icon name="download" />
      </button>
      <Show when={message()}>
        <Feedback message={message()} />
      </Show>
    </div>
  );
}

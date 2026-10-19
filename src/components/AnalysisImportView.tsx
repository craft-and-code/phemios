import { createSignal, onCleanup } from "solid-js";
import { ActionButton } from "./ActionButton";
import { parseAnalysisDocument, ANALYSIS_IMPORT_BYTES } from "../analysis-report/model";
import { t } from "../i18n";
/** Native-independent admission surface, shared by the App and real browser import scenarios. */
export function AnalysisImportView(props: {
  select?: (() => Promise<string | null>) | undefined;
  onImport: (files: unknown[]) => void;
  onError: (message: string) => void;
}) {
  const [busy, setBusy] = createSignal(false);
  let input!: HTMLInputElement,
    disposed = false;
  onCleanup(() => {
    disposed = true;
  });
  async function load(read: () => Promise<string | null>) {
    if (busy()) return;
    setBusy(true);
    try {
      const document = await read();
      if (disposed || document === null) return;
      const files = parseAnalysisDocument(document);
      props.onImport(files);
    } catch (error) {
      if (!disposed) props.onError(t(error instanceof Error ? error.message : String(error)));
    } finally {
      if (!disposed) setBusy(false);
    }
  }
  return (
    <>
      <ActionButton
        icon="upload"
        busy={busy()}
        onClick={() => {
          if (props.select) void load(props.select);
          else input.click();
        }}
      >
        {t("Importer une analyse")}
      </ActionButton>
      <input
        ref={(element) => {
          input = element;
        }}
        type="file"
        accept=".json,application/json"
        hidden
        aria-label={t("Rapport JSON FlacCompagnon")}
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          event.currentTarget.value = "";
          if (file)
            void load(async () => {
              if (file.size > ANALYSIS_IMPORT_BYTES)
                throw new Error("Le rapport dépasse la limite de 16 Mio.");
              return file.text();
            });
        }}
      />
    </>
  );
}

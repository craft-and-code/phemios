import { DownloadButton } from "./DownloadButton";
import { Feedback } from "./Feedback";
import { t } from "../i18n";
import { referenceSource, type SourceId } from "../library/sources";
import { createMemo, Show } from "solid-js";
import { annotationScope } from "../library/annotation-scope";
import { createExportState } from "../library/export-state";
import { saveLibraryM3U } from "../library/m3u-save";
import { Icon } from "./Icon";
import { useLibrary } from "../library/context";
import { downloadAede, isNative } from "../platform/desktop";
export interface M3UFile {
  source?: SourceId;
  id: string;
  name: string;
  filename: string;
  content: string;
  library_files?: string[];
}
/** Download exactly the M3U produced by Aède, retaining its server-side paths. */
export async function downloadM3U(file: M3UFile): Promise<string> {
  if (isNative()) return downloadAede(file.id, file.source);
  const url = URL.createObjectURL(
    new Blob([file.content], { type: "audio/x-mpegurl;charset=utf-8" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = file.filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 60000);
  return file.filename;
}
export function M3UExport(props: { release: string; title: string }) {
  const library = useLibrary();
  const scope = annotationScope(
    () => props.release,
    () => library.sessionFor(props.release),
  );
  const state = createExportState<ReturnType<typeof scope>, M3UFile>(scope);
  const file = state.file,
    busy = state.busy;
  const downloadIdentity = createMemo(() => ({ scope: scope(), file: file() }));
  async function download(value: M3UFile) {
    if (!scope().session || file() !== value) return false;
    const action = state.begin();
    if (!action) return false;
    try {
      const path = await downloadM3U(value);
      if (!action.current()) return false;
      action.feedback(t("M3U téléchargé : {0}", path));
      return true;
    } catch (failure) {
      action.feedback(
        failure instanceof Error ? failure.message : t("Téléchargement impossible."),
        true,
      );
      return false;
    } finally {
      action.finish();
    }
  }
  async function save() {
    const action = state.begin();
    if (!action) return;
    try {
      if (!action.scope.session) return;
      const saved = await saveLibraryM3U(action.scope.reference, props.title, action.current);
      if (saved) action.file({ ...saved, source: referenceSource(action.scope.reference) });
    } catch (failure) {
      action.feedback(failure instanceof Error ? failure.message : t("Export impossible."), true);
    } finally {
      action.finish();
    }
  }
  return (
    <div class="m3u-export">
      <Show when={file()}>
        <small title={file()?.library_files?.join("\n")}>
          {file()?.library_files?.length
            ? t("Enregistré dans les dossiers de la bibliothèque")
            : t("Enregistré sur le serveur · chemins du serveur")}
        </small>
      </Show>
      <button
        class="icon-button quiet"
        aria-label={t("Enregistrer le M3U sur Aède")}
        title={t("Enregistrer le M3U sur Aède")}
        disabled={
          !library.sessionFor(props.release) ||
          library.sessionFor(props.release)?.account.role !== "admin" ||
          busy()
        }
        onClick={save}
      >
        <Icon name="list" />
      </button>
      <Show when={file()}>
        {(value) => (
          <>
            <DownloadButton
              label={t("Télécharger le M3U")}
              identity={downloadIdentity()}
              disabled={busy()}
              onClick={() => download(value())}
            />
          </>
        )}
      </Show>
      <Show when={state.message()}>
        <Feedback message={state.message()} error={state.failed()} onClose={state.dismiss} />
      </Show>
    </div>
  );
}

import { M3UActions } from "./M3UActions";
import { lookupAlbumM3U } from "../library/m3u-lookup";
import { createDiagnosticRead } from "../library/diagnostic-read";
import { Feedback } from "./Feedback";
import { t } from "../i18n";
import { referenceSource, type SourceId } from "../library/sources";
import { createMemo, createEffect, on, Show } from "solid-js";
import { annotationScope } from "../library/annotation-scope";
import { createExportState } from "../library/export-state";
import { saveLibraryM3U } from "../library/m3u-save";
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
export type M3UDownloadFile = Omit<M3UFile, "content"> & { content?: string };
export async function downloadM3U(file: M3UDownloadFile): Promise<string> {
  if (isNative()) return downloadAede(file.id, file.source);
  if (file.content === undefined) throw Error(t("Contenu M3U invalide."));
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
export function M3UExport(props: {
  release: string;
  title: string;
  onStatus?: (message: string, failed: boolean) => void;
}) {
  const library = useLibrary();
  const scope = annotationScope(
    () => props.release,
    () => library.sessionFor(props.release),
  );
  const state = createExportState<ReturnType<typeof scope>, M3UDownloadFile>(scope);
  const lookup = createDiagnosticRead(
    () => (scope().session ? scope() : false),
    (held, admission) => lookupAlbumM3U(held.reference, admission.current),
  );
  const file = () => state.file() ?? lookup.current(),
    busy = state.busy;
  createEffect(on(scope, () => props.onStatus?.("", false)));
  createEffect(() =>
    props.onStatus?.(state.message() || lookup.error(), state.failed() || !!lookup.error()),
  );
  const downloadIdentity = createMemo(() => ({ scope: scope(), file: file() }));
  async function download(value: M3UDownloadFile) {
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
      if (!action.scope.session || file() || lookup.current() !== null || lookup.loading()) return;
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
      <M3UActions
        available={!!file()}
        canCreate={
          lookup.current() === null &&
          !lookup.loading() &&
          scope().session?.account.role === "admin"
        }
        enabled={!!scope().session}
        busy={busy()}
        identity={downloadIdentity()}
        onCreate={() => void save()}
        onDownload={() => {
          const value = file();
          return value ? download(value) : Promise.resolve(false);
        }}
      />
      <Show when={!props.onStatus && (state.message() || lookup.error())}>
        <Feedback
          message={state.message() || lookup.error()}
          error={state.failed() || !!lookup.error()}
          onClose={state.dismiss}
        />
      </Show>
    </div>
  );
}

import { createSignal, Show } from "solid-js";
import { Icon } from "./Icon";
import { useLibrary } from "../library/context";
import { requestAede, downloadAede, isNative } from "../platform/desktop";
export interface M3UFile {
  id: string;
  name: string;
  filename: string;
  content: string;
}
/** Download exactly the M3U produced by Aède, retaining its server-side paths. */
export async function downloadM3U(file: M3UFile): Promise<string> {
  if (isNative()) return downloadAede(file.id);
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
  const library = useLibrary(),
    [file, setFile] = createSignal<M3UFile>(),
    [busy, setBusy] = createSignal(false),
    [error, setError] = createSignal("");
  async function download(file: M3UFile) {
    setBusy(true);
    setError("");
    try {
      setError(`M3U téléchargé : ${await downloadM3U(file)}`);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Téléchargement impossible.");
    } finally {
      setBusy(false);
    }
  }
  async function save() {
    setBusy(true);
    setError("");
    try {
      setFile(
        await requestAede<M3UFile>("/api/me/v1/m3u", {}, "POST", {
          release: props.release,
          name: props.title,
        }),
      );
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Export impossible.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div class="m3u-export">
      <button
        class="icon-button quiet"
        aria-label="Enregistrer le M3U sur Aède"
        title="Enregistrer le M3U sur Aède"
        disabled={!library.session() || library.session()?.account.role === "auditor" || busy()}
        onClick={save}
      >
        <Icon name="list" />
      </button>
      <Show when={file()}>
        {(value) => (
          <>
            <button
              class="icon-button quiet"
              title="Télécharger le M3U"
              aria-label="Télécharger le M3U"
              disabled={busy()}
              onClick={() => download(value())}
            >
              <Icon name="download" />
            </button>
            <small>Enregistré sur le serveur · chemins du serveur</small>
          </>
        )}
      </Show>
      <Show when={error()}>
        <p role="status">{error()}</p>
      </Show>
    </div>
  );
}

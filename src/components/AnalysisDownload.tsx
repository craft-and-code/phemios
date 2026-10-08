import { createSignal, Show } from "solid-js";
import { downloadAnalysisAede } from "../platform/desktop";
import { useLibrary } from "../library/context";
/** Export comes from Aède; no user-selected filesystem path enters the native bridge. */
export function AnalysisDownload(props: {
  reference: string;
  album?: boolean;
  available: boolean;
}) {
  const library = useLibrary();
  const [busy, setBusy] = createSignal(false),
    [path, setPath] = createSignal(""),
    [failure, setFailure] = createSignal("");
  async function download() {
    setBusy(true);
    setFailure("");
    setPath("");
    try {
      setPath(await downloadAnalysisAede(props.reference));
    } catch (error) {
      setFailure(error instanceof Error ? error.message : "Téléchargement impossible.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div class="analysis-download">
      <button disabled={!library.session() || !props.available || busy()} onClick={download}>
        {busy()
          ? "Téléchargement…"
          : `Télécharger le JSON ${props.album ? "de l’album" : "du titre"}`}
      </button>
      <Show when={path()}>
        <small role="status">Enregistré : {path()}</small>
      </Show>
      <Show when={failure()}>
        <small role="alert">
          {failure()} Un rapport complet et actuel est nécessaire ; relancez l’analyse si besoin.
        </small>
      </Show>
    </div>
  );
}

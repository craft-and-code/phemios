import { createSignal, onCleanup } from "solid-js";
import { t } from "../i18n";
/** One explicit transfer at a time; leaving the page cannot publish stale UI feedback. */
export function createEpisodeDownloads(download: (url: string, title: string) => Promise<string>) {
  const [busy, setBusy] = createSignal(""),
    [message, setMessage] = createSignal(""),
    [failed, setFailed] = createSignal(false);
  let alive = true;
  onCleanup(() => {
    alive = false;
  });
  return {
    busy,
    message,
    failed,
    dismiss: () => setMessage(""),
    async save(url: string, title: string) {
      if (busy() || !alive) return;
      setBusy(url);
      setMessage("");
      setFailed(false);
      try {
        const path = await download(url, title);
        if (alive) setMessage(t("Épisode téléchargé : {0}", path));
      } catch (failure) {
        if (alive) {
          setFailed(true);
          setMessage(failure instanceof Error ? failure.message : String(failure));
        }
      } finally {
        if (alive) setBusy("");
      }
    },
  };
}

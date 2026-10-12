import { createEffect, createSignal, on, onCleanup } from "solid-js";
import { t } from "../i18n";
/** One explicit transfer per scope; owner replacement and closing cannot publish old episode feedback. */
export function createEpisodeDownloads(
  download: (url: string, title: string) => Promise<string>,
  scope: () => unknown = () => undefined,
) {
  const [busy, setBusy] = createSignal(""),
    [message, setMessage] = createSignal(""),
    [failed, setFailed] = createSignal(false);
  let alive = true,
    generation = 0,
    owner: unknown;
  const visible = () => alive && owner === scope();
  function reset() {
    generation++;
    owner = scope();
    setBusy("");
    setMessage("");
    setFailed(false);
  }
  createEffect(on(scope, reset));
  onCleanup(() => {
    alive = false;
    generation++;
  });
  return {
    busy: () => (visible() ? busy() : ""),
    message: () => (visible() ? message() : ""),
    failed: () => visible() && failed(),
    dismiss: () => setMessage(""),
    async save(url: string, title: string) {
      if ((visible() && busy()) || !alive) return false;
      const held = scope(),
        epoch = generation;
      owner = held;
      const current = () => alive && held === scope() && epoch === generation;
      setBusy(url);
      setMessage("");
      setFailed(false);
      try {
        const path = await download(url, title);
        if (current()) {
          setMessage(t("Épisode téléchargé : {0}", path));
          return true;
        }
        return false;
      } catch (failure) {
        if (current()) {
          setFailed(true);
          setMessage(failure instanceof Error ? failure.message : String(failure));
        }
        return false;
      } finally {
        if (current()) setBusy("");
      }
    },
  };
}

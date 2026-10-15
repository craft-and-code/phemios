import { createSignal, Show, type JSX } from "solid-js";
import { t } from "../i18n";
import { Icon } from "./Icon";
import { ActionButton } from "./ActionButton";
/** File browsing is secondary; switching presentations never resets or owns the session queue. */
export function PlaylistsView(props: {
  queue: (navigation: JSX.Element) => JSX.Element;
  files: (navigation: JSX.Element) => JSX.Element;
}) {
  const [files, setFiles] = createSignal(false);
  return (
    <Show
      when={files()}
      fallback={props.queue(
        <ActionButton
          class="playlist-files-toggle"
          aria-label={t("Parcourir les fichiers M3U")}
          title={t("Parcourir les fichiers M3U")}
          onClick={() => setFiles(true)}
        >
          {t("Parcourir les fichiers M3U")}
        </ActionButton>,
      )}
    >
      {props.files(
        <button
          class="icon-button quiet"
          aria-label={t("Revenir à la liste de lecture")}
          title={t("Revenir à la liste de lecture")}
          onClick={() => setFiles(false)}
        >
          <Icon name="back" />
        </button>,
      )}
    </Show>
  );
}

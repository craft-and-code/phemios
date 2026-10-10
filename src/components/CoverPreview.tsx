import { t } from "../i18n";
import { onMount, onCleanup, Show } from "solid-js";
import type { Album } from "../library/types";
import { Icon } from "./Icon";
import { Artwork } from "./Artwork";
import { useLibrary } from "../library/context";
/** Native dialog provides Escape, keyboard focus containment and trigger restoration. */
export function CoverPreview(props: { album: Album; onClose: () => void }) {
  const library = useLibrary();
  let dialog: HTMLDialogElement | undefined;
  let heading: HTMLHeadingElement | undefined;
  onMount(() => {
    dialog?.showModal();
    heading?.focus();
  });
  onCleanup(() => dialog?.close());
  return (
    <dialog
      ref={(element) => {
        dialog = element;
      }}
      class="cover-dialog"
      aria-label={t("Pochette de {0}", props.album.title)}
      onCancel={(event) => {
        event.preventDefault();
        props.onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) props.onClose();
      }}
    >
      <div>
        <div class="cover-dialog-heading">
          <h2
            ref={(element) => {
              heading = element;
            }}
            tabindex="-1"
          >
            {props.album.title}
          </h2>
          <button
            class="icon-button quiet icon-close"
            aria-label={t("Fermer la pochette")}
            onClick={props.onClose}
          >
            <Icon name="close" />
          </button>
        </div>
        <Show
          when={library.image(props.album.reference, "cover")}
          fallback={<Artwork album={props.album} />}
        >
          {(url) => (
            <img
              class="cover-preview-image"
              src={url()}
              alt={t("Pochette : {0}", props.album.title)}
            />
          )}
        </Show>
      </div>
    </dialog>
  );
}

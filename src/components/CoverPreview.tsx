import { onMount, onCleanup } from "solid-js";
import type { Album } from "../library/types";
import { Artwork } from "./Artwork";
/** Native dialog provides Escape, keyboard focus containment and trigger restoration. */
export function CoverPreview(props: { album: Album; onClose: () => void }) {
  let dialog: HTMLDialogElement | undefined;
  onMount(() => dialog?.showModal());
  onCleanup(() => dialog?.close());
  return (
    <dialog
      ref={(element) => {
        dialog = element;
      }}
      class="cover-dialog"
      aria-label={`Pochette de ${props.album.title}`}
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
          <h2>{props.album.title}</h2>
          <button aria-label="Fermer la pochette" onClick={props.onClose}>
            ×
          </button>
        </div>
        <Artwork album={props.album} />
      </div>
    </dialog>
  );
}

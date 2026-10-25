import { t } from "../i18n";
import { onMount, onCleanup, Show, type JSX } from "solid-js";
import { Icon } from "./Icon";
/** Native dialog provides Escape, keyboard focus containment and trigger restoration. */
export function CoverPreviewView(props: {
  title: string;
  image?: string | undefined;
  fallback: JSX.Element;
  onClose: () => void;
}) {
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
      aria-label={t("Pochette de {0}", props.title)}
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
            {props.title}
          </h2>
          <button
            class="icon-button quiet icon-close"
            aria-label={t("Fermer la pochette")}
            onClick={props.onClose}
          >
            <Icon name="close" />
          </button>
        </div>
        <Show when={props.image} fallback={props.fallback}>
          {(url) => (
            <img class="cover-preview-image" src={url()} alt={t("Pochette : {0}", props.title)} />
          )}
        </Show>
      </div>
    </dialog>
  );
}

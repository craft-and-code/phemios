import { For, onCleanup, onMount } from "solid-js";
import { t } from "../i18n";
import type { BiographyTrackChoice } from "../library/biography-links";
import { Icon } from "./Icon";

/** Explicit edition choice keeps equal titles from silently choosing a catalogue placement. */
export function BiographyTrackChoices(props: {
  title: string;
  tracks: readonly BiographyTrackChoice[];
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
      class="biography-tracks-dialog"
      aria-label={t("Choisir une version de {0}", props.title)}
      onCancel={(event) => {
        event.preventDefault();
        props.onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) props.onClose();
      }}
    >
      <div class="section-heading">
        <h2
          ref={(element) => {
            heading = element;
          }}
          tabindex="-1"
        >
          {t("Choisir une version de {0}", props.title)}
        </h2>
        <button
          type="button"
          class="icon-button quiet icon-close"
          aria-label={t("Fermer")}
          onClick={props.onClose}
        >
          <Icon name="close" />
        </button>
      </div>
      <ul>
        <For each={props.tracks}>
          {(track) => (
            <li>
              <a href={`#/track/${encodeURIComponent(track.reference)}`} onClick={props.onClose}>
                <strong>{track.title}</strong>
                <span>
                  {[
                    track.artist,
                    track.album ?? t("Sans album"),
                    track.year,
                    track.number == null ? undefined : t("Piste {0}", track.number),
                  ]
                    .filter((value) => value !== undefined)
                    .join(" · ")}
                </span>
              </a>
            </li>
          )}
        </For>
      </ul>
    </dialog>
  );
}

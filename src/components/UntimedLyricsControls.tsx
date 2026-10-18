import { Icon } from "./Icon";
import { t } from "../i18n";
/** Manual navigation exposes supplied untimed lines without coupling them to the audio clock. */
export function UntimedLyricsControls(props: {
  index: number;
  total: number;
  previous: () => void;
  next: () => void;
}) {
  return (
    <div class="untimed-lyrics-controls">
      <button
        class="icon-button quiet"
        disabled={props.index === 0}
        aria-label={t("Phrase précédente")}
        onClick={props.previous}
      >
        <Icon name="previous" />
      </button>
      <small>
        {t("Paroles non synchronisées")} · {props.index + 1}/{props.total}
      </small>
      <button
        class="icon-button quiet"
        disabled={props.index + 1 >= props.total}
        aria-label={t("Phrase suivante")}
        onClick={props.next}
      >
        <Icon name="next" />
      </button>
    </div>
  );
}

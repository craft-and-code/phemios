import { t } from "../i18n";
/** The unavailable marker is inert; finite durations retain the elapsed/remaining switch. */
export function DurationToggle(props: {
  duration: number | null;
  position: number;
  remaining: boolean;
  onToggle: () => void;
}) {
  const time = (ms: number) =>
    `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, "0")}`;
  return (
    <button
      class="time-toggle"
      disabled={props.duration === null}
      aria-label={props.remaining ? t("Afficher la durée totale") : t("Afficher le temps restant")}
      aria-pressed={props.remaining}
      onClick={props.onToggle}
    >
      {props.duration === null
        ? "—"
        : props.remaining
          ? `−${time(Math.max(0, props.duration - props.position))}`
          : time(props.duration)}
    </button>
  );
}

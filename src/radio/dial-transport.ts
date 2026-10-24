import type { Station } from "./directory";
import type { createRadioPlayback } from "./playback";
/** The dial controls its selected station, sharing Stop and cancellation with the footer. */
export function createRadioDialTransport(
  selected: () => Station | undefined,
  radio: Pick<ReturnType<typeof createRadioPlayback>, "station" | "status" | "start" | "stop">,
  busy: () => boolean,
) {
  const stopping = () =>
    !!selected() &&
    selected()!.uuid === radio.station()?.uuid &&
    (radio.status() === "playing" || radio.status() === "connecting");
  const disabled = () => !stopping() && (busy() || !selected());
  return {
    stopping,
    disabled,
    activate() {
      if (stopping()) radio.stop();
      else if (!disabled()) {
        const station = selected();
        if (station) void radio.start(station);
      }
    },
  };
}

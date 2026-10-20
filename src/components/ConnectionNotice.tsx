import { aedeAvailability } from "../library/aede-availability";
import { sourceLabel } from "../library/sources";
import { t } from "../i18n";
import { Feedback } from "./Feedback";
/** One stable slot for current-source outages; cached navigation remains available. */
export function ConnectionNotice() {
  const message = () =>
    aedeAvailability
      .unavailable()
      .map((source) => `${sourceLabel(source)} · ${t("Impossible de joindre Aède.")}`)
      .join("\n");
  return (
    <Feedback class="connection-notice" message={message()} error persistent connectionNotice />
  );
}

import { createResource, createSignal } from "solid-js";
import { configureConcerts, isNative } from "../platform/desktop";
import { t } from "../i18n";
import { Feedback } from "../components/Feedback";
import { JamBaseSettingsView } from "../components/JamBaseSettingsView";
import { canRemoveConcertKey } from "../library/concert-config";
/** Retained keys and quota are native-only; opening settings performs no provider request. */
export function SettingsJamBase() {
  const [key, setKey] = createSignal(""),
    [busy, setBusy] = createSignal(false),
    [error, setError] = createSignal(""),
    [message, setMessage] = createSignal("");
  const [configuration, { refetch }] = createResource(async () => {
    try {
      return { status: await configureConcerts(), error: "" };
    } catch (failure) {
      return { status: undefined, error: String(failure) };
    }
  });
  const configured = () => configuration()?.status;
  async function save(remove: boolean) {
    if (busy()) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await configureConcerts(remove ? null : key(), remove);
      setKey("");
      await refetch();
      setMessage(t("Configuration enregistrée sur cet appareil."));
    } catch (failure) {
      setError(String(failure));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <JamBaseSettingsView
        status={configured()}
        key={key()}
        busy={busy()}
        native={isNative()}
        removable={canRemoveConcertKey(
          isNative(),
          busy(),
          configuration()?.error
            ? { ready: false, error: String(configuration()?.error) }
            : configured(),
        )}
        onKey={setKey}
        onSave={(remove) => void save(remove)}
      />
      <Feedback message={message()} />
      <Feedback error message={error() || String(configuration()?.error ?? "")} />
    </>
  );
}

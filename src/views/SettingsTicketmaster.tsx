import { createResource, createSignal, Show } from "solid-js";
import { configureConcerts, isNative } from "../platform/desktop";
import { t } from "../i18n";
import { ActionButton } from "../components/ActionButton";
import { Feedback } from "../components/Feedback";
/** The provider secret stays native; only presence is read into the settings form. */
export function SettingsTicketmaster() {
  const [key, setKey] = createSignal(""),
    [busy, setBusy] = createSignal(false),
    [error, setError] = createSignal(""),
    [message, setMessage] = createSignal("");
  const [configured, { refetch }] = createResource(async () => {
    try {
      return { ready: await configureConcerts() };
    } catch (failure) {
      return { ready: false, error: String(failure) };
    }
  });
  async function save(remove = false) {
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
    <section class="ticketmaster-settings">
      <h3>Ticketmaster Discovery · {configured()?.ready ? t("configurée") : t("absente")}</h3>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <label>
          {t("Clé Ticketmaster Discovery")}
          <input
            type="password"
            autocomplete="off"
            value={key()}
            onInput={(event) => setKey(event.currentTarget.value)}
          />
        </label>
        <div class="settings-actions">
          <ActionButton
            type="submit"
            icon="check"
            busy={busy()}
            disabled={!isNative() || !key().trim()}
          >
            {t("Enregistrer")}
          </ActionButton>
          <ActionButton
            type="button"
            icon="trash"
            disabled={busy() || !configured()?.ready}
            onClick={() => void save(true)}
          >
            {t("Supprimer la clé")}
          </ActionButton>
        </div>
      </form>
      <p class="muted">
        {t(
          "Les dates proviennent de Ticketmaster. La clé reste sur cette machine ; aucun compte Aède n’est nécessaire pour cette recherche.",
        )}{" "}
        <a href="https://developer.ticketmaster.com/products-and-docs/apis/getting-started/">
          {t("Obtenir une clé")}
        </a>
      </p>
      <Show when={message()}>
        <Feedback message={message()} />
      </Show>
      <Feedback error message={error() || configured()?.error || ""} />
    </section>
  );
}

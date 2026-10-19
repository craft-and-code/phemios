import { DisplayAwakeSettings } from "../components/DisplayAwakeSettings";
import { Feedback } from "../components/Feedback";
import { createSignal, Show } from "solid-js";
import { t } from "../i18n";
import { Icon } from "../components/Icon";
import { connectHqPlayer, disconnectHqPlayer, isNative } from "../platform/desktop";
import {
  readHqPlayer,
  hqPlayerKey,
  defaultHqPlayer,
  type HqPlayerSettings,
} from "../library/hqplayer-settings";
import { useLibrary } from "../library/context";
/** Saving a machine endpoint never sends playback or modifies the external engine's queue. */
export function SettingsPlayback() {
  const library = useLibrary(),
    [value, setValue] = createSignal<HqPlayerSettings>({ ...defaultHqPlayer }),
    [error, setError] = createSignal(""),
    [message, setMessage] = createSignal(""),
    [busy, setBusy] = createSignal(false);
  try {
    setValue(readHqPlayer(localStorage.getItem(hqPlayerKey)));
  } catch (failure) {
    setError(String(failure));
  }
  const update = (key: keyof HqPlayerSettings, next: string) =>
    setValue((old) => ({ ...old, [key]: key === "port" ? Number(next) : next }));
  async function save(test: boolean) {
    if (busy()) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const settings = readHqPlayer(JSON.stringify(value()));
      localStorage.setItem(hqPlayerKey, JSON.stringify(settings));
      setMessage(t("Configuration enregistrée sur cet appareil."));
      if (test) {
        const reply = await connectHqPlayer(
          settings.host,
          settings.port,
          settings.from ? [{ from: settings.from, to: settings.to }] : [],
        );
        setMessage(t("HQPlayer connecté · {0} {1}", reply.product, reply.version));
        await library.player.discover();
      }
    } catch (failure) {
      setError(String(failure));
    } finally {
      setBusy(false);
    }
  }
  async function disconnect() {
    setBusy(true);
    setError("");
    try {
      await disconnectHqPlayer();
      setMessage(t("HQPlayer déconnecté."));
      await library.player.discover();
    } catch (failure) {
      setError(String(failure));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <DisplayAwakeSettings
        enabled={library.displayAwake.enabled()}
        disabled={!isNative()}
        error={library.displayAwake.error()}
        onChange={library.displayAwake.setEnabled}
      />
      <section class="settings-card">
        <h2>{t("Fondu entre les morceaux")}</h2>
        <label>
          {library.player.crossfade()
            ? t("Durée : {0} s", library.player.crossfade() / 1000)
            : t("Désactivé")}
          <input
            type="range"
            min="0"
            max="10000"
            step="500"
            value={library.player.crossfade()}
            disabled={
              library.player.busy() ||
              library.player.policy() !== "dsp" ||
              library.player.isCd() ||
              library.player.device() === "@hqplayer"
            }
            onInput={(event) =>
              void library.player.chooseCrossfade(Number(event.currentTarget.value))
            }
          />
        </label>
        <p class="muted">
          {t(
            "Le fondu mélange deux flux dans le mode DSP. Sans DSP et avec HQPlayer, il reste désactivé. La durée est réduite pour les morceaux courts ; les durées inconnues sont enchaînées sans fondu.",
          )}
        </p>
        <Feedback error message={library.player.error()} />
      </section>
      <section class="settings-card hqplayer-settings">
        <h2>HQPlayer</h2>
        <p>
          {t(
            "HQPlayer Desktop ou Embedded doit être installé séparément. Le calcul audio et le choix du DAC sont réalisés sur sa machine.",
          )}
        </p>
        <p>
          {t(
            "Activez le contrôle réseau dans HQPlayer. Les pistes doivent être accessibles depuis sa machine dans un dossier partagé ; aucune clé Aède ne lui est transmise.",
          )}
        </p>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void save(true);
          }}
        >
          <div class="settings-field-grid">
            <label>
              {t("Adresse HQPlayer")}
              <input
                value={value().host}
                onInput={(e) => update("host", e.currentTarget.value)}
                placeholder="localhost"
              />
            </label>
            <label>
              {t("Port de contrôle")}
              <input
                type="number"
                min="1"
                max="65535"
                value={value().port}
                onInput={(e) => update("port", e.currentTarget.value)}
              />
            </label>
          </div>
          <h3>{t("Correspondance des dossiers · facultative")}</h3>
          <div class="settings-field-grid">
            <label>
              {t("Dossier vu par Aède")}
              <input
                value={value().from}
                onInput={(e) => update("from", e.currentTarget.value)}
                placeholder="/music"
              />
            </label>
            <label>
              {t("Même dossier vu par HQPlayer")}
              <input
                value={value().to}
                onInput={(e) => update("to", e.currentTarget.value)}
                placeholder="/shared/music"
              />
            </label>
          </div>
          <div class="settings-actions">
            <button type="button" disabled={busy()} onClick={() => void save(false)}>
              <Icon name="check" />
              {t("Enregistrer")}
            </button>
            <button type="submit" disabled={busy() || !isNative()}>
              <Show when={busy()} fallback={<Icon name="settings" />}>
                <span class="spinner" />
              </Show>
              {t("Tester la connexion")}
            </button>
            <button
              type="button"
              disabled={busy() || !isNative()}
              onClick={() => void disconnect()}
            >
              <Icon name="disconnect" />
              {t("Déconnecter")}
            </button>
          </div>
        </form>
        <p class="muted">
          {t(
            "Sélectionnez ensuite HQPlayer dans Sortie et mode de lecture. Le changement entre HQPlayer et une sortie système arrête la lecture. Les effets DSP, le niveau audio et l'historique confirmé d'Aède ne sont pas disponibles pour cette sortie.",
          )}
        </p>
        <Show when={message()}>
          <Feedback message={message()} />
        </Show>
        <Show when={error()}>
          <Feedback error message={error()} onClose={() => setError("")} />
        </Show>
      </section>
    </>
  );
}

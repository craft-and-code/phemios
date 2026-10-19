import { networkAudioAddress } from "../network-audio/address";
import { Icon } from "./Icon";
import { createEffect, createSignal, Show } from "solid-js";
import { useLibrary } from "../library/context";
import { t } from "../i18n";
import { ChoiceSelect } from "./ChoiceSelect";
import { ActionButton } from "./ActionButton";
import { RefreshButton } from "./RefreshButton";
import { Feedback } from "./Feedback";
/** A bounded original-file queue is sent directly by the selected Aède engine. */
export function NetworkAudio() {
  const library = useLibrary(),
    audio = library.networkAudio;
  const automatic = () => networkAudioAddress(library.source(), library.session()?.server);
  const [editing, setEditing] = createSignal(false);
  const [bind, setBind] = createSignal(""),
    [endpoint, setEndpoint] = createSignal("");
  createEffect(() => {
    library.source();
    library.session();
    setBind(automatic());
    setEditing(false);
    setEndpoint("");
  });
  return (
    <section class="network-audio-settings">
      <div class="section-heading">
        <h3>UPnP</h3>
        <RefreshButton
          label={t("Rechercher des appareils UPnP")}
          busy={audio.busy()}
          disabled={!audio.enabled() || !bind().trim() || audio.active()}
          onCancel={audio.cancelRead}
          onRefresh={() => void audio.discover(bind().trim())}
        />
      </div>
      <Show
        when={!automatic() || editing()}
        fallback={
          <div class="network-audio-address">
            <small>
              {t("Adresse réseau")} · {bind()}
            </small>
            <button
              class="icon-button quiet"
              title={t("Modifier l’adresse réseau")}
              aria-label={t("Modifier l’adresse réseau")}
              disabled={audio.busy() || audio.active()}
              onClick={() => setEditing(true)}
            >
              <Icon name="edit" />
            </button>
          </div>
        }
      >
        <label>
          {t("Adresse IPv4 locale de la machine Aède")}
          <input
            value={bind()}
            placeholder="192.168.1.10"
            disabled={audio.busy() || audio.active()}
            onInput={(event) => {
              setBind(event.currentTarget.value);
              setEndpoint("");
            }}
          />
        </label>
      </Show>
      <ChoiceSelect
        label={t("Lecteur UPnP")}
        value={endpoint()}
        disabled={audio.busy() || audio.active() || !audio.devices().length}
        onChange={setEndpoint}
        options={[
          { value: "", label: t("Choisir un appareil") },
          ...audio.devices().map((row) => ({ value: row.endpoint, label: row.name })),
        ]}
      />
      <div class="settings-actions">
        <ActionButton
          icon="play"
          title={t("Arrête la lecture locale et lance la liste sur le lecteur UPnP.")}
          disabled={
            !audio.enabled() ||
            audio.busy() ||
            audio.active() ||
            !endpoint() ||
            !library.player.queue().length
          }
          onClick={() => void audio.start(bind().trim(), endpoint())}
        >
          {t("Écouter sur le lecteur UPnP")}
        </ActionButton>
        <ActionButton
          icon="stop"
          disabled={audio.busy() || !audio.active()}
          onClick={() => void audio.stop()}
        >
          {t("Arrêter UPnP")}
        </ActionButton>
      </div>
      <Show when={!audio.enabled()}>
        <p class="muted">
          {t("Un compte administrateur est nécessaire pour ce premier raccordement UPnP.")}
        </p>
      </Show>
      <Show when={audio.run()}>
        <p role="status">
          {audio.run()?.status === "stop_unconfirmed"
            ? t("Arrêt UPnP non confirmé par l’appareil.")
            : audio.run()?.status === "failed"
              ? t("La transmission UPnP a échoué.")
              : audio.active()
                ? t("Transmission UPnP en cours · arrêt disponible ici.")
                : t("Transmission UPnP terminée.")}
        </p>
      </Show>
      <Feedback error message={audio.error()} onClose={audio.clearError} />
    </section>
  );
}

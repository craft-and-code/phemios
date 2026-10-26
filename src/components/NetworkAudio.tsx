import { deviceKey, protocolNames } from "../network-audio/profiles";
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
    [endpoint, setEndpoint] = createSignal(""),
    [slim, setSlim] = createSignal(""),
    [trusted, setTrusted] = createSignal(false),
    [replace, setReplace] = createSignal(false);
  const selected = () => audio.devices().find((row) => deviceKey(row) === endpoint());
  createEffect(() => {
    endpoint();
    audio.observed();
    setTrusted(false);
    setReplace(false);
  });
  createEffect(() => {
    library.source();
    library.session();
    setBind(automatic());
    setEditing(false);
    setEndpoint("");
    setSlim("");
  });
  return (
    <section class="network-audio-settings">
      <div class="section-heading">
        <h3>{t("Lecteurs réseau")}</h3>
        <RefreshButton
          identity={library.session()}
          label={t("Rechercher des lecteurs réseau")}
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
        label={t("Lecteur réseau")}
        value={endpoint()}
        disabled={audio.busy() || audio.active() || !audio.devices().length}
        onChange={setEndpoint}
        options={[
          { value: "", label: t("Choisir un appareil") },
          ...audio.devices().map((row) => ({
            value: deviceKey(row),
            label: `${row.name} · ${protocolNames[row.protocol]}`,
          })),
        ]}
      />
      <details class="network-audio-manual">
        <summary>{t("Ajouter un lecteur SlimProto")}</summary>
        <label>
          {t("Adresse IPv4 du lecteur")}
          <input
            value={slim()}
            placeholder="192.168.1.20"
            disabled={audio.busy() || audio.active()}
            onInput={(event) => setSlim(event.currentTarget.value)}
          />
        </label>
        <ActionButton
          icon="plus"
          disabled={
            !audio.enabled() || audio.busy() || audio.active() || !bind().trim() || !slim().trim()
          }
          onClick={() => void audio.addSlimproto(bind().trim(), slim().trim())}
        >
          {t("Ajouter le lecteur")}
        </ActionButton>
      </details>
      <Show when={selected()?.protocol === "googlecast"}>
        <ActionButton
          icon="integrity"
          disabled={audio.busy() || audio.active()}
          onClick={() => void audio.inspect(endpoint())}
        >
          {t("Inspecter le certificat Cast")}
        </ActionButton>
        <Show when={audio.observed()?.key === endpoint() ? audio.observed() : undefined}>
          {(value) => (
            <div class="network-audio-certificate">
              <code>{value().sha256}</code>
              <label>
                <input
                  type="checkbox"
                  checked={trusted()}
                  disabled={audio.busy() || audio.active()}
                  onChange={(event) => setTrusted(event.currentTarget.checked)}
                />
                {t("J’ai vérifié cette empreinte sur mon réseau de confiance.")}
              </label>
            </div>
          )}
        </Show>
      </Show>
      <Show when={["openhome", "googlecast"].includes(selected()?.protocol ?? "")}>
        <label>
          <input
            type="checkbox"
            checked={replace()}
            disabled={audio.busy() || audio.active()}
            onChange={(event) => setReplace(event.currentTarget.checked)}
          />
          {t("Autoriser le remplacement de la lecture ou de la liste existante")}
        </label>
      </Show>
      <Show when={selected()?.protocol === "slimproto"}>
        <p class="muted">
          {t(
            "Après le lancement, connectez le lecteur SlimProto à {0}:3483. La lecture attend sa connexion pendant une minute.",
            bind(),
          )}
        </p>
      </Show>
      <small>
        {t("Profils expérimentaux · fichiers originaux · compatibilité matérielle à vérifier.")}
      </small>
      <div class="settings-actions">
        <ActionButton
          icon="play"
          title={t("Arrête la lecture locale et lance la liste sur le lecteur réseau.")}
          disabled={
            !audio.enabled() ||
            audio.busy() ||
            audio.active() ||
            !endpoint() ||
            (selected()?.protocol === "googlecast" && !trusted()) ||
            !library.player.queue().length
          }
          onClick={() =>
            void audio.start(bind().trim(), endpoint(), {
              replace: replace(),
              ...(trusted() && audio.observed() ? { pin: audio.observed()!.sha256 } : {}),
            })
          }
        >
          {t("Écouter sur le lecteur réseau")}
        </ActionButton>
        <ActionButton
          icon="stop"
          disabled={audio.busy() || !audio.active()}
          onClick={() => void audio.stop()}
        >
          {t("Arrêter le lecteur réseau")}
        </ActionButton>
      </div>
      <Show when={!audio.enabled()}>
        <p class="muted">{t("Un compte administrateur est nécessaire pour les sorties réseau.")}</p>
      </Show>
      <Show when={audio.run()}>
        <p role="status">
          {audio.run()?.status === "stop_unconfirmed"
            ? t("Arrêt non confirmé par l’appareil.")
            : audio.run()?.status === "failed"
              ? t("La transmission réseau a échoué.")
              : audio.active()
                ? t("Transmission réseau en cours · arrêt disponible ici.")
                : t("Transmission réseau terminée.")}
        </p>
      </Show>
      <Feedback error message={audio.error()} onClose={audio.clearError} />
    </section>
  );
}

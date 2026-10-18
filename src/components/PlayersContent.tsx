import { For, Show } from "solid-js";
import { t } from "../i18n";
import type { PlayerVolume } from "../library/players";
import { EmptyState } from "./EmptyState";
import { Icon } from "./Icon";
import { PageLoader } from "./PageLoader";
import { ActionButton } from "./ActionButton";
/** Initial discovery and refresh share one page-centred activity; canceled reads can reveal retained volumes. */
export function PlayersContent(props: {
  busy: boolean;
  error?: unknown;
  volumes: readonly PlayerVolume[] | undefined;
  selected: string;
  disabled?: boolean;
  onSelect: (path: string) => void;
  ejecting?: string;
  onEject?: (id: string) => void;
  onRemove?: (id: string) => void;
  removing?: string;
}) {
  return (
    <Show when={!props.busy} fallback={<PageLoader label={t("Détection des lecteurs…")} />}>
      <p class="muted">
        {t(
          "Branchez et montez le lecteur dans votre système, puis actualisez. Les partages réseau montés apparaissent aussi.",
        )}
      </p>
      <Show when={props.error}>
        <p role="alert">{String(props.error)}</p>
      </Show>
      <Show when={!props.busy && !props.error && !props.volumes?.length}>
        <EmptyState icon="drive">{t("Aucun lecteur monté détecté.")}</EmptyState>
      </Show>
      <ul class="personal-list">
        <For each={props.volumes}>
          {(volume) => (
            <li class="player-destination-row">
              <span class="player-device-icon">
                <Icon
                  name={
                    volume.adapter === "ipod" && (!volume.icon || volume.icon === "drive")
                      ? "ipod"
                      : (volume.icon ?? "drive")
                  }
                />
              </span>
              <div>
                <strong>{volume.name}</strong>
                <small>
                  {volume.path}
                  <Show when={volume.format}> · {volume.format}</Show> ·{" "}
                  {volume.kind === "network"
                    ? t("Réseau")
                    : volume.kind === "removable"
                      ? t("Amovible")
                      : volume.kind === "folder"
                        ? t("Dossier")
                        : t("Volume monté")}
                </small>
                <Show when={volume.model}>
                  <small>{volume.model}</small>
                </Show>
                <Show when={volume.unavailableReason}>
                  <small class="player-unavailable">{t(volume.unavailableReason!)}</small>
                </Show>
              </div>
              <Show when={volume.adapter === "ipod" && !volume.unavailableReason}>
                <small>
                  {volume.available === false ? t("podkit requis") : t("iPod Apple · podkit")}
                </small>
              </Show>
              <div class="player-destination-actions">
                <ActionButton
                  aria-pressed={props.selected === (volume.id ?? volume.path)}
                  disabled={
                    props.disabled ||
                    !!props.ejecting ||
                    !!props.removing ||
                    volume.available === false
                  }
                  onClick={() => props.onSelect(volume.id ?? volume.path)}
                >
                  {t("Sélectionner")}
                </ActionButton>
                <Show when={volume.kind === "folder" && volume.id && props.onRemove}>
                  <button
                    type="button"
                    class="icon-button"
                    title={t("Retirer {0}", volume.name)}
                    aria-label={t("Retirer {0}", volume.name)}
                    aria-busy={props.removing === volume.id || undefined}
                    disabled={props.disabled || !!props.ejecting || !!props.removing}
                    onClick={() => props.onRemove?.(volume.id!)}
                  >
                    <Show when={props.removing === volume.id} fallback={<Icon name="close" />}>
                      <span class="spinner" aria-hidden="true" />
                    </Show>
                  </button>
                </Show>
                <Show when={props.onEject && volume.id && volume.ejectable}>
                  <button
                    type="button"
                    class="icon-button"
                    aria-label={t("Éjecter {0}", volume.name)}
                    title={t("Éjecter {0}", volume.name)}
                    aria-busy={props.ejecting === volume.id || undefined}
                    disabled={props.disabled || !!props.ejecting || !!props.removing}
                    onClick={() => props.onEject?.(volume.id!)}
                  >
                    <Show when={props.ejecting === volume.id} fallback={<Icon name="eject" />}>
                      <span class="spinner" aria-hidden="true" />
                    </Show>
                  </button>
                </Show>
              </div>
            </li>
          )}
        </For>
      </ul>
      <Show when={props.volumes?.some((row) => (row.id ?? row.path) === props.selected)}>
        <p class="notice">
          {t(
            "Destination sélectionnée : {0}",
            props.volumes?.find((row) => (row.id ?? row.path) === props.selected)?.name,
          )}
        </p>
      </Show>
    </Show>
  );
}

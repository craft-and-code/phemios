import { For, Show } from "solid-js";
import { t } from "../i18n";
import type { PlayerVolume } from "../library/players";
import { EmptyState } from "./EmptyState";
import { Icon } from "./Icon";
import { PageLoader } from "./PageLoader";
/** Initial discovery and refresh share one page-centred activity; canceled reads can reveal retained volumes. */
export function PlayersContent(props: {
  busy: boolean;
  error?: unknown;
  volumes: readonly PlayerVolume[] | undefined;
  selected: string;
  disabled?: boolean;
  onSelect: (path: string) => void;
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
            <li>
              <Icon name="drive" />
              <div>
                <strong>{volume.name}</strong>
                <small>
                  {volume.path} · {volume.format} ·{" "}
                  {volume.kind === "network"
                    ? t("Réseau")
                    : volume.kind === "removable"
                      ? t("Amovible")
                      : t("Volume monté")}
                </small>
              </div>
              <Show when={volume.adapter === "ipod"}>
                <small>
                  {volume.available === false ? t("podkit requis") : t("iPod Apple · podkit")}
                </small>
              </Show>
              <button
                aria-pressed={props.selected === (volume.id ?? volume.path)}
                disabled={props.disabled || volume.available === false}
                onClick={() => props.onSelect(volume.id ?? volume.path)}
              >
                {t("Sélectionner")}
              </button>
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

import { For, Show } from "solid-js";
import { t } from "../i18n";
import type { PlayableSelection } from "../library/playback-selection";
import { fileSize } from "../library/detail-format";
import {
  transferPhases,
  transferProgress,
  type TransferOptions,
  type TransferPreview,
  type TransferStatus,
} from "../library/transfers";
import { ChoiceSelect } from "./ChoiceSelect";
import { Icon } from "./Icon";
import { ActionButton } from "./ActionButton";
import { Feedback } from "./Feedback";
/** Reviewable copy recipe and retained native progress; no device writes occur while selecting. */
export function TransferPanel(props: {
  rows: readonly PlayableSelection[];
  destination: string;
  ipod: boolean;
  mtp?: boolean;
  options: TransferOptions;
  preview: TransferPreview | undefined;
  status: TransferStatus;
  preparing: boolean;
  disabled?: boolean;
  error: string;
  onOptions: (value: TransferOptions) => void;
  onPreview: () => void;
  onStart: () => void;
  onCancel: () => void;
}) {
  const locked = () =>
    props.status.running || props.preparing || !!props.disabled || !props.destination;
  return (
    <section class="transfer-panel">
      <h3>{t("Options de transfert")}</h3>
      <div class="transfer-options">
        <label>
          <span>{t("Format de destination")}</span>
          <ChoiceSelect
            label={t("Format de destination")}
            disabled={locked() || props.ipod}
            value={props.options.format}
            options={[
              {
                value: "original",
                label: props.ipod
                  ? t("Automatique iPod · ALAC / AAC")
                  : t("Original · sans conversion"),
              },
              { value: "mp3", label: "MP3" },
              { value: "aac", label: "AAC / M4A" },
              { value: "opus", label: "Opus" },
              { value: "flac", label: "FLAC" },
              { value: "wav", label: "WAV" },
            ]}
            onChange={(format) =>
              props.onOptions({ ...props.options, format: format as TransferOptions["format"] })
            }
          />
        </label>
        <label class="check-label">
          <input
            type="checkbox"
            disabled={locked() || props.ipod}
            checked={props.options.verify && !props.ipod}
            onChange={(e) => props.onOptions({ ...props.options, verify: e.currentTarget.checked })}
          />
          {t("Vérifier les fichiers copiés et déjà présents")}
        </label>
        <label class="check-label">
          <input
            type="checkbox"
            disabled={locked() || props.ipod || props.mtp}
            checked={props.options.replace && !props.ipod}
            onChange={(e) =>
              props.onOptions({ ...props.options, replace: e.currentTarget.checked })
            }
          />
          {t("Autoriser le remplacement des fichiers existants")}
        </label>
      </div>
      <p class="muted transfer-explanation">
        {props.ipod
          ? t(
              "podkit gère la compatibilité et la base musicale de l’iPod. Les morceaux existants sont conservés. La vérification octet par octet n’est pas disponible pour cet adaptateur.",
            )
          : t(
              "Aède copie les originaux et convertit seulement les sources sans perte. FFmpeg est nécessaire pour convertir. FAT/exFAT peut nécessiter l’autorisation de remplacement.",
            )}
      </p>
      <Show when={props.error}>
        <Feedback error message={props.error} persistent />
      </Show>
      <Show when={!props.status.running}>
        <div class="transfer-actions">
          <ActionButton
            icon="search"
            busy={props.preparing}
            disabled={locked() || !props.rows.length || !props.destination}
            onClick={props.onPreview}
          >
            {t("Préparer l’aperçu")}
          </ActionButton>
          <ActionButton
            icon="download"
            class="primary"
            disabled={locked() || !props.preview}
            onClick={props.onStart}
          >
            {t("Démarrer le transfert")}
          </ActionButton>
        </div>
      </Show>
      <Show when={props.preview}>
        {(preview) => (
          <div class="transfer-preview">
            <strong>
              {t(
                preview().tracks === 1 ? "{0} piste · {1}" : "{0} pistes · {1}",
                preview().tracks,
                fileSize(preview().bytes),
              )}
            </strong>
            <p>
              {props.ipod
                ? t(
                    "Aucun fichier n’a encore été écrit sur l’iPod. podkit organisera ces pistes dans sa base musicale.",
                  )
                : t(
                    "Aucun fichier n’a encore été écrit sur le lecteur. Les noms affichés correspondent aux fichiers de destination.",
                  )}
            </p>
            <Show when={props.options.format !== "original" && !props.ipod}>
              <p class="muted">
                {t(
                  "Le volume indiqué est celui des sources ; la taille finale dépend de la conversion.",
                )}
              </p>
            </Show>
            <ul>
              <For each={preview().files}>{(path) => <li>{path}</li>}</For>
            </ul>
          </div>
        )}
      </Show>
      <Show when={props.status.phase !== "idle"}>
        <section class="transfer-progress" aria-live="polite">
          <div class="page-heading">
            <strong>{t(transferPhases[props.status.phase] ?? props.status.phase)}</strong>
            <Show when={props.status.running}>
              <button
                class="icon-button quiet"
                title={t("Arrêter après le fichier en cours")}
                aria-label={t("Arrêter après le fichier en cours")}
                onClick={props.onCancel}
              >
                <Icon name="stop" />
              </button>
            </Show>
          </div>
          <progress max="1" value={transferProgress(props.status)} />
          <p>{t("{0} / {1} pistes", props.status.done ?? 0, props.status.total ?? 0)}</p>
          <Show when={props.status.current}>
            <p class="transfer-current">{props.status.current}</p>
          </Show>
          <Show when={props.status.error}>
            <Feedback error persistent message={props.status.error!} />
          </Show>
        </section>
      </Show>
    </section>
  );
}

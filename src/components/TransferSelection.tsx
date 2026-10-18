import { For, Show } from "solid-js";
import { t } from "../i18n";
import type { PlayableSelection } from "../library/playback-selection";
import { Icon } from "./Icon";
/** Music selection remains available before a destination is discovered or chosen. */
export function TransferSelection(props: {
  rows: readonly PlayableSelection[];
  disabled: boolean;
  onRemove: (reference: string) => void;
}) {
  return (
    <section class="transfer-panel transfer-selection-panel">
      <div class="page-heading">
        <h3>{t("Musique à transférer")}</h3>
      </div>
      <Show when={!props.rows.length}>
        <p class="muted">{t("Ajoutez des pistes, albums, artistes, collections ou listes M3U.")}</p>
      </Show>
      <ul class="transfer-selection">
        <For each={props.rows}>
          {(row) => (
            <li>
              <span>
                <strong>{row.title}</strong>
                <small>
                  {row.artist}
                  <Show when={row.album}> · {row.album?.title}</Show>
                </small>
              </span>
              <button
                class="icon-button quiet icon-close"
                disabled={props.disabled}
                title={t("Retirer {0}", row.title)}
                aria-label={t("Retirer {0}", row.title)}
                onClick={() => props.onRemove(row.reference)}
              >
                <Icon name="close" />
              </button>
            </li>
          )}
        </For>
      </ul>
      <p class="muted">
        {t(
          props.rows.length === 1 ? "{0} piste sélectionnée" : "{0} pistes sélectionnées",
          props.rows.length,
        )}
      </p>
    </section>
  );
}

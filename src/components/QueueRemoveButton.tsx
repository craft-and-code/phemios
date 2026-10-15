import { t } from "../i18n";
import { Icon } from "./Icon";
/** Remove one queue occurrence without activating the containing playable row. */
export function QueueRemoveButton(props: {
  title: string;
  disabled: boolean;
  reason?: string | undefined;
  onRemove: () => void;
}) {
  return (
    <button
      type="button"
      class="icon-button quiet icon-close queue-remove"
      disabled={props.disabled}
      aria-label={t("Retirer {0} de la liste de lecture", props.title)}
      title={props.reason ?? t("Retirer {0} de la liste de lecture", props.title)}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        props.onRemove();
      }}
    >
      <Icon name="close" />
    </button>
  );
}

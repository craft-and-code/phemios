import { t } from "../i18n";
import { Icon } from "./Icon";
import { ScrubRange } from "./ScrubRange";
/** Explicit pixel size; pointer double-click or keyboard activation restores the default. */
export function CoverSize(props: {
  value: number;
  resetValue?: number;
  disabled: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <div
      role="group"
      aria-label={t("Taille des pochettes")}
      class="cover-size-control"
      classList={{ "cover-size-disabled": props.disabled }}
      title={t("Taille des pochettes · double-clic pour réinitialiser")}
    >
      <button
        type="button"
        class="cover-size-reset"
        aria-label={t("Taille des pochettes · double-clic pour réinitialiser")}
        title={t("Taille des pochettes · double-clic pour réinitialiser")}
        disabled={props.disabled}
        onDblClick={() => {
          if (!props.disabled) props.onChange(props.resetValue ?? 150);
        }}
        onClick={(event) => {
          if (!props.disabled && event.detail === 0) props.onChange(props.resetValue ?? 150);
        }}
      >
        <Icon name="cover-size" />
      </button>
      <ScrubRange
        class="cover-size-range"
        aria-label={t("Taille des pochettes")}
        title={t("Taille des pochettes · double-clic pour réinitialiser")}
        min={100}
        max={280}
        step={10}
        value={props.value}
        disabled={props.disabled}
        onInput={(e) => props.onChange(Number(e.currentTarget.value))}
        onDblClick={() => {
          if (!props.disabled) props.onChange(props.resetValue ?? 150);
        }}
      />
      <output class="cover-size-value">{props.value} px</output>
    </div>
  );
}

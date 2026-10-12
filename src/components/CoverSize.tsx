import { t } from "../i18n";
import { Icon } from "./Icon";
import { ScrubRange } from "./ScrubRange";
/** Explicit cover density, with a native range and double-click restoration. */
export function CoverSize(props: {
  value: number;
  disabled: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <label
      class="cover-size-control"
      classList={{ "cover-size-disabled": props.disabled }}
      title={t("Taille des pochettes · double-clic pour réinitialiser")}
    >
      <Icon name="cover-size" />
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
          if (!props.disabled) props.onChange(150);
        }}
      />
    </label>
  );
}

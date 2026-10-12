import { For } from "solid-js";
import { t } from "../i18n";
import { ChoiceSelect } from "./ChoiceSelect";
import type { RoonMapping } from "../imports/roon-plan";
/** Explicit column choices keep editorial ratings separate from personal stars. */
export function RoonImportMapping(props: {
  headers: readonly string[];
  mapping: RoonMapping;
  disabled: boolean;
  onChange: (value: RoonMapping) => void;
}) {
  const fields: readonly {
    key: Exclude<keyof RoonMapping, "favourites" | "tagSeparator">;
    label: string;
  }[] = [
    { key: "artist", label: "Artiste" },
    { key: "album", label: "Album" },
    { key: "year", label: "Année" },
    { key: "rating", label: "Étoiles personnelles (1–5)" },
    { key: "loved", label: "Favori" },
    { key: "tags", label: "Tags" },
    { key: "note", label: "Note personnelle" },
  ];
  return (
    <>
      <div class="roon-import-fields">
        <For each={fields}>
          {(field) => (
            <label>
              <span>{t(field.label)}</span>
              <ChoiceSelect
                label={t(field.label)}
                value={props.mapping[field.key]}
                disabled={props.disabled}
                options={[
                  { value: "-1", label: t("Ne pas importer") },
                  ...props.headers.map((header, index) => ({
                    value: String(index),
                    label: header,
                  })),
                ]}
                onChange={(value) =>
                  props.onChange({ ...props.mapping, [field.key]: Number(value) })
                }
              />
            </label>
          )}
        </For>
        <label>
          <span>{t("Séparateur des tags")}</span>
          <ChoiceSelect
            value={props.mapping.tagSeparator}
            label={t("Séparateur des tags")}
            disabled={props.disabled}
            options={[
              { value: ";", label: ";" },
              { value: ",", label: "," },
              { value: "|", label: "|" },
            ]}
            onChange={(value) =>
              props.onChange({
                ...props.mapping,
                tagSeparator: value as RoonMapping["tagSeparator"],
              })
            }
          />
        </label>
      </div>
      <label class="checkbox">
        <input
          type="checkbox"
          checked={props.mapping.favourites}
          disabled={props.disabled}
          onChange={(event) =>
            props.onChange({ ...props.mapping, favourites: event.currentTarget.checked })
          }
        />
        {t("Cet export contient uniquement mes albums favoris : les marquer comme favoris")}
      </label>
    </>
  );
}

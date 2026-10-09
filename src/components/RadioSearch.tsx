import { For } from "solid-js";
import { t } from "../i18n";
import { radioEnterSearch, type RadioCriteria } from "../radio/search";
/** All three text fields share explicit native Enter submission; HTTPS is below the fields. */
export function RadioSearch(props: {
  value: RadioCriteria;
  change: (value: Partial<RadioCriteria>) => void;
  submit: () => void;
  busy: boolean;
  available: boolean;
}) {
  return (
    <form
      class="radio-search"
      onSubmit={(event) => {
        event.preventDefault();
        props.submit();
      }}
      onKeyDown={(event) => {
        const input = event.target;
        if (
          input instanceof HTMLInputElement &&
          radioEnterSearch(event.key, event.isComposing, input.type)
        ) {
          event.preventDefault();
          event.currentTarget.requestSubmit();
        }
      }}
    >
      <div class="radio-search-fields">
        <For
          each={[
            { key: "name" as const, label: t("Station"), placeholder: t("Nom de la station…") },
            { key: "country" as const, label: t("Pays"), placeholder: t("France, Germany…") },
            { key: "tag" as const, label: t("Style"), placeholder: t("rock, jazz, classical…") },
          ]}
        >
          {(field) => (
            <label>
              {t(field.label)}
              <input
                type={field.key === "name" ? "search" : "text"}
                enterkeyhint="search"
                maxlength="256"
                placeholder={t(field.placeholder)}
                value={props.value[field.key]}
                onInput={(event) => props.change({ [field.key]: event.currentTarget.value })}
              />
            </label>
          )}
        </For>
      </div>
      <div class="radio-search-actions">
        <label class="radio-secure">
          <input
            type="checkbox"
            checked={props.value.secureOnly}
            onChange={(event) => props.change({ secureOnly: event.currentTarget.checked })}
          />
          {t("Flux HTTPS uniquement")}
        </label>
        <button type="submit" class="primary" disabled={props.busy || !props.available}>
          {props.busy ? t("Recherche…") : t("Explorer les stations")}
        </button>
      </div>
    </form>
  );
}

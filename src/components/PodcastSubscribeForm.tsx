import { InlineActionForm } from "./InlineActionForm";
import { ActionButton } from "./ActionButton";
import { t } from "../i18n";
/** Controlled RSS acquisition form; account and transport admission stay with its caller. */
export function PodcastSubscribeForm(props: {
  url: string;
  busy: boolean;
  disabled: boolean;
  onInput: (value: string) => void;
  onSubscribe: () => void;
}) {
  return (
    <InlineActionForm
      class="podcast-add"
      onSubmit={(event) => {
        event.preventDefault();
        if (!props.disabled && !props.busy && props.url.trim()) props.onSubscribe();
      }}
    >
      <label>
        {t("Lien RSS du podcast")}
        <input
          type="url"
          required
          placeholder="https://example.org/podcast.xml"
          value={props.url}
          disabled={props.disabled || props.busy}
          onInput={(event) => props.onInput(event.currentTarget.value)}
        />
      </label>
      <ActionButton
        type="submit"
        class="primary"
        icon="plus"
        busy={props.busy}
        disabled={props.disabled || !props.url.trim()}
      >
        {t("S’abonner")}
      </ActionButton>
    </InlineActionForm>
  );
}

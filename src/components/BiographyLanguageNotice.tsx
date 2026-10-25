import { Show } from "solid-js";
import { locale, t } from "../i18n";

/** A retained or provider-fallback text never silently impersonates the current UI language. */
export function BiographyLanguageNotice(props: { language: string | undefined }) {
  const name = () => {
    const code = props.language ?? "";
    return /^[a-z]{2}$/.test(code)
      ? (new Intl.DisplayNames([locale()], { type: "language" }).of(code) ?? code)
      : code;
  };
  return (
    <Show when={props.language && props.language !== locale()}>
      <p class="muted biography-language-notice">{t("Biographie affichée en {0}.", name())}</p>
    </Show>
  );
}

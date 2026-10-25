import { createSignal, Show } from "solid-js";
import { t } from "../i18n";
import { Icon } from "./Icon";

/** Resident label marks keep their aspect ratio and a stable fallback on decoding failure. */
export function LabelLogoView(props: { name: string; url?: string | undefined; large?: boolean }) {
  const [failed, setFailed] = createSignal<string>();
  return (
    <span class="label-logo" classList={{ "label-logo-large": props.large }}>
      <Show
        when={props.url && failed() !== props.url}
        fallback={
          <span role="img" aria-label={t("Logo indisponible pour {0}", props.name)}>
            <Icon name="label" />
          </span>
        }
      >
        <img
          src={props.url}
          alt={t("Logo de {0}", props.name)}
          decoding="sync"
          onError={() => setFailed(props.url)}
        />
      </Show>
    </span>
  );
}

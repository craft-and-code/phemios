import { Show } from "solid-js";
import { t } from "../i18n";
/** Optional owner-private album marker; unknown completion never looks like an unplayed album. */
export function AlbumUnplayed(props: { visible?: boolean | undefined }) {
  return (
    <Show when={props.visible}>
      <span
        class="album-unplayed"
        role="img"
        aria-label={t("Album pas encore écouté intégralement")}
        title={t("Album pas encore écouté intégralement")}
      />
    </Show>
  );
}

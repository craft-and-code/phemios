import { Show } from "solid-js";
import { useLibrary } from "../library/context";
import { createFavouriteControl } from "../library/favourite-control";
import { t } from "../i18n";
import { Icon } from "./Icon";
/** Owner-private favourite of the playing track, synchronized with the detail annotation. */
export function PlayingFavourite(props: { reference: string }) {
  const library = useLibrary(),
    loved = () => library.annotations[props.reference]?.loved ?? false;
  const control = createFavouriteControl(
    () => props.reference,
    () => library.sessionFor(props.reference),
    loved,
    library.updateAnnotation,
  );
  return (
    <span class="playing-favourite">
      <button
        class="annotation-heart"
        disabled={control.blocked() || control.busy()}
        aria-pressed={loved()}
        aria-label={
          loved()
            ? t("Retirer la piste en lecture des favoris")
            : t("Ajouter la piste en lecture aux favoris")
        }
        title={
          loved()
            ? t("Retirer la piste en lecture des favoris")
            : t("Ajouter la piste en lecture aux favoris")
        }
        onClick={() => void control.toggle()}
      >
        <Icon name="heart" />
      </button>
      <Show when={control.error()}>
        <small role="alert">{control.error()}</small>
      </Show>
    </span>
  );
}

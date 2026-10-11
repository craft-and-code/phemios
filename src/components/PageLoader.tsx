import { t } from "../i18n";
/** An activity indicator centred inside its positioned view leaves status text to accessibility rather than page chrome. */
export function PageLoader(props: { label?: string }) {
  return (
    <div class="page-loader" role="status" aria-label={props.label ?? t("Chargement…")}>
      <span class="spinner" aria-hidden="true" />
    </div>
  );
}

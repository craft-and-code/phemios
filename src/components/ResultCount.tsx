import { locale, t } from "../i18n";
/** Counts describe all matched items, rather than the current pagination window. */
export function ResultCount(props: { value: number }) {
  return (
    <span class="result-count" role="status">
      {t("{0} résultat(s)", props.value.toLocaleString(locale()))}
    </span>
  );
}

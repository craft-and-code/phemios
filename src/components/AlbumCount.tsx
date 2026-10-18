import { locale } from "../i18n";
import { albumCount } from "../library/album-count";
/** Text-only count preserves each caller's typography and reacts to count/language changes. */
export function AlbumCount(props: { value: number }) {
  return <>{albumCount(props.value, locale())}</>;
}

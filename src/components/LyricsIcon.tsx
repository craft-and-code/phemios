import { Icon } from "./Icon";
/** A clock marks confirmed synchronized words; an unknown source is never labelled plain text. */
export function LyricsIcon(props: { synced?: boolean | undefined }) {
  return <Icon name={props.synced === true ? "lyrics-timed" : "lyrics"} />;
}

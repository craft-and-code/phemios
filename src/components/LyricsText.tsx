import { For } from "solid-js";
import { t } from "../i18n";
import { useLibrary } from "../library/context";
import { activeLyricTime, type Lyrics } from "../library/lyrics";
/** Preserve complete words; timed lines seek only the already active native track. */
export function LyricsText(props: { lyrics: Lyrics; reference: string }) {
  const player = useLibrary().player;
  const current = () =>
    player.current()?.reference === props.reference &&
    ["playing", "paused"].includes(player.state().status);
  const time = () => (current() ? activeLyricTime(props.lyrics, player.seekPosition()) : null);
  const source = () =>
    props.lyrics.source === "tag"
      ? t("Balise audio")
      : props.lyrics.source === "sidecar"
        ? t("Fichier LRC")
        : props.lyrics.source;
  return (
    <>
      <small class="muted">
        {t("Source : {0}", source())} ·{" "}
        {props.lyrics.synced ? t("Paroles synchronisées") : t("Paroles non synchronisées")}
      </small>
      <div class="lyrics-lines">
        <For each={props.lyrics.lines}>
          {(line) => (
            <button
              classList={{ "lyric-active": line.at_ms !== null && line.at_ms === time() }}
              disabled={!current() || line.at_ms === null || player.busy()}
              onClick={() => {
                if (current() && line.at_ms !== null) void player.seek(line.at_ms);
              }}
            >
              {line.text || "\u00a0"}
            </button>
          )}
        </For>
      </div>
    </>
  );
}

import { footerTransport } from "./contextual-play";
import type { createPlayback } from "../library/playback";
import type { createRadioPlayback } from "../radio/playback";
import type { createPodcastPlayback } from "../podcasts/playback";
type Audio = {
  player: Pick<ReturnType<typeof createPlayback>, "busy" | "state" | "toggleMute" | "action">;
  radio: Pick<ReturnType<typeof createRadioPlayback>, "station" | "mute" | "stop">;
  podcast: Pick<ReturnType<typeof createPodcastPlayback>, "episode" | "mute" | "stop">;
};
/** Route global transport shortcuts without changing page-specific Play selection. */
export async function controlAudioShortcut(
  action: "mute" | "stop" | "next" | "previous",
  audio: Audio,
) {
  const media = audio.podcast.episode()
    ? audio.podcast
    : audio.radio.station()
      ? audio.radio
      : undefined;
  if (media) {
    if (action === "mute") media.mute();
    else if (action === "stop") media.stop();
    return;
  }
  const player = audio.player;
  if (player.busy()) return;
  if (action === "mute") await player.toggleMute();
  else if (["playing", "paused", "ended"].includes(player.state().status))
    await player.action(action);
}

type ToggleAudio = {
  player: Pick<
    ReturnType<typeof createPlayback>,
    "busy" | "state" | "queue" | "action" | "togglePlayback" | "startReference"
  >;
  radio: Pick<ReturnType<typeof createRadioPlayback>, "station" | "status" | "pause" | "resume">;
  podcast: Pick<
    ReturnType<typeof createPodcastPlayback>,
    "episode" | "status" | "pause" | "resume"
  >;
};
/** Prepared-list priority is independent of the visible page's contextual Play target. */
export async function toggleAudioShortcut(audio: ToggleAudio, reference: string) {
  const player = audio.player;
  if (player.busy()) return;
  const keyboardTransport = footerTransport({
    queueView: true,
    queued: player.queue().length > 0,
    podcast: !!audio.podcast.episode(),
    radio: !!audio.radio.station(),
  });
  const media =
    keyboardTransport === "podcast"
      ? audio.podcast
      : keyboardTransport === "radio"
        ? audio.radio
        : undefined;
  if (media) {
    if (media.status() === "playing") media.pause();
    else if (media.status() !== "connecting") await media.resume();
    return;
  }
  if (player.queue().length) {
    await player.togglePlayback();
    return;
  }
  if (player.state().status === "playing") await player.action("pause");
  else if (player.state().status === "paused") await player.action("resume");
  else if (reference) await player.startReference(reference);
}

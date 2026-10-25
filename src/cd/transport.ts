import type { createPlayback } from "../library/playback";
import { cdPlaybackAction, type CdDisc } from "./model";

type CdPlayer = Pick<ReturnType<typeof createPlayback>, "state" | "busy" | "action" | "startDisc">;

/** Pause/resume the selected current disc without replacing its queue or restarting its track. */
export async function activateCdPlayback(
  player: CdPlayer,
  disc: CdDisc | undefined,
  index?: number,
) {
  if (!disc || player.busy()) return;
  if (index !== undefined && (!Number.isInteger(index) || index < 0 || !disc.tracks[index])) return;
  const state = player.state();
  const action = cdPlaybackAction(
    disc.token,
    state.source === "cd" ? state.reference : "",
    state.status,
    index === undefined ? undefined : disc.tracks[index]?.reference,
  );
  if (action === "play") await player.startDisc(disc, index ?? 0);
  else await player.action(action);
}

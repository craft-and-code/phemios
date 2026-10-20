import type { createPlayback } from "../library/playback";

/** Confirm local transport shutdown before admitting a network renderer. */
export async function prepareNetworkPlayback(
  player: Pick<ReturnType<typeof createPlayback>, "busy" | "state" | "action">,
  failure: string,
): Promise<void> {
  // A pending native start can still expose the previous idle snapshot.
  if (player.busy()) throw new Error(failure);
  if (["playing", "paused", "connecting"].includes(player.state().status)) {
    await player.action("stop");
    if (["playing", "paused", "connecting"].includes(player.state().status))
      throw new Error(failure);
  }
}

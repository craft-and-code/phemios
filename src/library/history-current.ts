import type { AccountSession } from "./server";
import type { PlayableSelection } from "./playback-selection";
/** Current output is a separate ephemeral row, never a confirmed listen or an extra history write. */
export function currentHistoryListen(input: {
  item: PlayableSelection | undefined;
  owner: AccountSession | undefined;
  session: AccountSession | undefined;
  status: string;
  offset: number;
}) {
  return input.item &&
    input.session &&
    input.owner === input.session &&
    input.offset === 0 &&
    ["playing", "paused"].includes(input.status)
    ? input.item
    : undefined;
}

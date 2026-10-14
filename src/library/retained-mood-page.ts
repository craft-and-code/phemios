import type { AccountSession } from "./server";
import type { SourceId } from "./sources";
import type { MoodPage } from "./moods";
/** Captured ownership and paging identity of one confirmed mood reply. */
export interface MoodKey {
  session: AccountSession | undefined;
  source: SourceId;
  selected: string;
  offset: number;
}
/** Capabilities are retained alongside the exact page they authorized. */
export interface MoodReply extends MoodKey {
  page: MoodPage;
  audio: boolean;
  extractable: boolean;
}
/** Keep a confirmed same-owner page during progress refreshes; reject stale source/selection pages. */
export function retainedMoodPage(
  resource: { (): MoodReply | undefined; readonly latest: MoodReply | undefined },
  key: MoodKey,
): MoodPage | undefined {
  const value = resource.latest;
  return value &&
    value.session === key.session &&
    value.source === key.source &&
    value.selected === key.selected &&
    value.offset === key.offset
    ? value.page
    : undefined;
}

import { createMemo, type Accessor } from "solid-js";
import type { PlaybackState } from "./playback-state";
import { waveformPath, type Waveform } from "./waveform";
export interface WaveformResult {
  reference: string;
  waveform?: Waveform;
  error?: string;
}
/** Separate immutable envelope geometry from clock/seek updates; never draw a previous track's data. */
export function createWaveformPresentation(
  state: Accessor<PlaybackState>,
  latest: Accessor<WaveformResult | undefined>,
  draw = waveformPath,
) {
  const reference = createMemo(() => {
    const value = state();
    return ["playing", "paused", "connecting"].includes(value.status) ? value.reference : "";
  });
  const current = createMemo(() => {
    const value = latest();
    return value?.reference === reference() ? value : undefined;
  });
  return createMemo(() => {
    const row = current();
    return { path: row?.waveform ? draw(row.waveform) : "", error: row?.error ?? "" };
  });
}

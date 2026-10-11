import { createRoot, createSignal } from "solid-js";
import { expect, it, vi } from "vitest";
import { idlePlayback, type PlaybackState } from "./playback-state";
import { createWaveformPresentation, type WaveformResult } from "./waveform-presentation";
import { waveformPath } from "./waveform";
it("keeps the resident drawing through seek buffering, pause and clock updates, rebuilding only for another envelope", () => {
  createRoot((dispose) => {
    const [state, setState] = createSignal<PlaybackState>({
      ...idlePlayback,
      status: "playing",
      reference: "track:one",
    });
    const [latest, setLatest] = createSignal<WaveformResult>({
      reference: "track:one",
      waveform: {
        reference: "track:one",
        duration_ms: 1000,
        sample_rate: 8000,
        bucket_frames: 4000,
        peaks: [0.2, 0.8],
      },
    });
    const draw = vi.fn(waveformPath),
      view = createWaveformPresentation(state, latest, draw);
    const resident = view();
    expect(view().duration_ms).toBe(1000);
    setState((s) => ({
      ...s,
      status: "connecting",
      position_ms: 700,
      duration_ms: null,
      seek_id: 1,
    }));
    expect(view()).toBe(resident);
    for (let position = 700; position < 720; position++)
      setState((s) => ({ ...s, status: "playing", position_ms: position }));
    setState((s) => ({ ...s, status: "paused" }));
    expect(view()).toBe(resident);
    expect(draw).toHaveBeenCalledOnce();
    setState((s) => ({ ...s, reference: "track:two" }));
    expect(view().path).toBe("");
    setLatest({
      reference: "track:two",
      waveform: { ...latest().waveform!, reference: "track:two" },
    });
    expect(view().path).not.toBe("");
    expect(draw).toHaveBeenCalledTimes(2);
    setState((s) => ({ ...s, status: "idle" }));
    expect(view().path).toBe("");
    dispose();
  });
});

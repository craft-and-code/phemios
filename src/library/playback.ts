import { createSignal, onCleanup, type Accessor } from "solid-js";
import {
  playbackControl,
  playbackOutputs,
  playbackStart,
  playbackState,
} from "../platform/desktop";
import { idlePlayback, parseOutputs, parsePlayback, type AudioOutput } from "./playback-state";
import type { Track } from "./server";
import type { Album } from "./types";
interface Selection {
  reference: string;
  title: string;
  album: Album;
  artist: string;
}
const message = (failure: unknown) =>
  failure instanceof Error ? failure.message : "Lecture indisponible.";
/** Explicit playback owns one serialized poll; it never starts during offline browsing. */
export function createPlayback(ready: Accessor<boolean>) {
  const [state, setState] = createSignal(idlePlayback),
    [outputs, setOutputs] = createSignal<AudioOutput[]>([]),
    [device, setDevice] = createSignal(""),
    [selection, setSelection] = createSignal<Selection[]>([]),
    [error, setError] = createSignal(""),
    [busy, setBusy] = createSignal(false);
  let timer: ReturnType<typeof setTimeout> | undefined,
    generation = 0,
    lifetime = 0;
  function cancel() {
    generation++;
    clearTimeout(timer);
    timer = undefined;
  }
  async function refresh(epoch: number) {
    try {
      const value = parsePlayback(await playbackState());
      if (epoch !== generation) return;
      setState(value);
      if (!["idle", "ended", "error"].includes(value.status))
        timer = setTimeout(() => void refresh(epoch), 250);
    } catch (failure) {
      if (epoch === generation) setError(message(failure));
    }
  }
  async function action(command: string, value: unknown = null) {
    if (busy()) return;
    setBusy(true);
    setError("");
    cancel();
    const epoch = generation;
    try {
      await playbackControl(command, value);
      await refresh(epoch);
    } catch (failure) {
      if (epoch === generation) {
        setError(message(failure));
        void refresh(epoch);
      }
    } finally {
      if (epoch === generation) setBusy(false);
    }
  }
  async function start(tracks: readonly Track[], album: Album, artist: string, index = 0) {
    if (!ready() || busy()) return;
    setBusy(true);
    setError("");
    cancel();
    const epoch = generation;
    try {
      if (!tracks.length || tracks.length > 64 || index < 0 || index >= tracks.length)
        throw new Error("Sélection limitée à 64 pistes.");
      await playbackStart(
        tracks.map((t) => t.reference),
        device(),
        index,
      );
      if (epoch !== generation) return;
      setSelection(tracks.map((t) => ({ reference: t.reference, title: t.title, album, artist })));
      await refresh(epoch);
    } catch (failure) {
      if (epoch === generation) setError(message(failure));
    } finally {
      if (epoch === generation) setBusy(false);
    }
  }
  async function discover() {
    const epoch = generation;
    setError("");
    try {
      const value = parseOutputs(await playbackOutputs());
      if (epoch === generation) setOutputs(value);
    } catch (failure) {
      if (epoch === generation) setError(message(failure));
    }
  }
  let pendingVolume: number | undefined,
    volumeRunning = false;
  async function volume(value: number) {
    pendingVolume = value;
    if (volumeRunning) return;
    volumeRunning = true;
    const epoch = lifetime;
    try {
      while (pendingVolume !== undefined && epoch === lifetime) {
        const next = pendingVolume;
        pendingVolume = undefined;
        await playbackControl("volume", next);
        if (epoch === lifetime) setState((s) => ({ ...s, volume: next }));
      }
    } catch (failure) {
      if (epoch === lifetime) setError(message(failure));
    } finally {
      volumeRunning = false;
    }
  }
  async function chooseOutput(id: string) {
    if (busy()) return;
    const previous = device();
    setDevice(id);
    if (!["idle", "ended", "error"].includes(state().status)) {
      await action("output", id);
      if (error()) setDevice(previous);
    }
  }
  function reset() {
    lifetime++;
    cancel();
    setBusy(false);
    pendingVolume = undefined;
    setState({ ...idlePlayback, volume: state().volume });
    setSelection([]);
    setOutputs([]);
    setDevice("");
    setError("");
  }
  onCleanup(() => {
    lifetime++;
    cancel();
  });
  return {
    state,
    outputs,
    device,
    error,
    busy,
    ready,
    start,
    action,
    discover,
    chooseOutput,
    volume,
    reset,
    current: () => selection().find((t) => t.reference === state().reference),
  };
}

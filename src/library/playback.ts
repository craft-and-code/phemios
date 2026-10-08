import { createSignal, onCleanup, type Accessor } from "solid-js";
import {
  playbackControl,
  playbackOutputs,
  playbackStart,
  playbackState,
  requestAede,
} from "../platform/desktop";
import { idlePlayback, parseOutputs, parsePlayback, type AudioOutput } from "./playback-state";
import type { Track } from "./server";
import { playbackSelection, type PlayableSelection } from "./playback-selection";
import type { Artist, Album } from "./types";
const message = (failure: unknown) =>
  failure instanceof Error ? failure.message : "Lecture indisponible.";
/** Explicit playback owns one serialized poll; it never starts during offline browsing. */
export function createPlayback(
  ready: Accessor<boolean>,
  catalog?: () => { albums: readonly Album[]; artists: readonly Artist[] },
) {
  const [state, setState] = createSignal(idlePlayback),
    [outputs, setOutputs] = createSignal<AudioOutput[]>([]),
    [device, setDevice] = createSignal(""),
    [selection, setSelection] = createSignal<PlayableSelection[]>([]),
    [error, setError] = createSignal(""),
    [busy, setBusy] = createSignal(false),
    [target, setTarget] = createSignal(""),
    [remaining, setRemaining] = createSignal(false),
    [policy, setPolicy] = createSignal("without-effects");
  let audibleVolume = 0.5,
    preferenceKey = "";
  function identify(key: string) {
    preferenceKey = `phemios.playback-time:${key}`;
    try {
      setRemaining(sessionStorage.getItem(preferenceKey) === "remaining");
    } catch {
      setError("Préférence de durée indisponible.");
    }
  }
  function toggleTime() {
    const next = !remaining();
    setRemaining(next);
    if (preferenceKey)
      try {
        sessionStorage.setItem(preferenceKey, next ? "remaining" : "duration");
      } catch {
        setError("Préférence de durée non mémorisée.");
      }
  }
  async function choosePolicy(value: string) {
    if (!["without-effects", "dsp"].includes(value) || busy()) return;
    setPolicy(value);
    if (["playing", "paused"].includes(state().status)) await action("policy", value);
  }
  async function startReference(reference = target()) {
    if (!ready() || busy() || !reference || !catalog) return;
    setBusy(true);
    setError("");
    cancel();
    const epoch = generation;
    try {
      const response = await requestAede("/api/v1/presentation/playback", { ref: reference });
      if (epoch !== generation) return;
      const data = catalog(),
        rows = playbackSelection(response, data.albums, data.artists);
      await playbackStart(
        rows.map((r) => r.reference),
        device(),
        0,
        policy(),
      );
      if (epoch !== generation) return;
      setSelection(rows);
      await refresh(epoch);
    } catch (failure) {
      if (epoch === generation) setError(message(failure));
    } finally {
      if (epoch === generation) setBusy(false);
    }
  }
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
      if (!tracks.length || tracks.length > 4096 || index < 0 || index >= tracks.length)
        throw new Error("Sélection limitée à 4096 pistes.");
      await playbackStart(
        tracks.map((t) => t.reference),
        device(),
        index,
        policy(),
      );
      if (epoch !== generation) return;
      setSelection(
        tracks.map((t, i) => ({
          reference: t.reference,
          title: t.title,
          album,
          artist,
          number: i + 1,
          albumTotal: tracks.length,
        })),
      );
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
    if (value > 0) audibleVolume = value;
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
  async function toggleMute() {
    await volume(state().volume > 0 ? 0 : audibleVolume);
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
    setTarget("");
    setRemaining(false);
    preferenceKey = "";
    setPolicy("without-effects");
  }
  onCleanup(() => {
    lifetime++;
    cancel();
  });
  return {
    target,
    setTarget,
    startReference,
    identify,
    remaining,
    toggleTime,
    policy,
    choosePolicy,
    toggleMute,
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
    current: () => {
      const row = selection()[state().index];
      return row?.reference === state().reference ? row : undefined;
    },
  };
}

import {
  audioPreferenceKey,
  defaultAudioPreferences,
  parseAudioPreferences,
  type AudioPreferences,
} from "./audio-preferences";
import { announceSetting } from "./saved-settings";
import { t } from "../i18n";
import { createMemo, createSignal, onCleanup, type Accessor } from "solid-js";
import {
  playbackControl,
  playbackOutputs,
  playbackStart,
  playbackState,
  requestAede,
} from "../platform/desktop";
import { idlePlayback, parseOutputs, parsePlayback, type AudioOutput } from "./playback-state";
import type { Track } from "./server";
import { createSeekProgress } from "./seek-progress";
import { playbackSelection, type PlayableSelection } from "./playback-selection";
import type { Artist, Album } from "./types";
const message = (failure: unknown) =>
  failure instanceof Error ? failure.message : t("Lecture indisponible.");
/** Explicit playback owns one serialized poll; it never starts during offline browsing. */
export function createPlayback(
  ready: Accessor<boolean>,
  catalog?: () => { albums: readonly Album[]; artists: readonly Artist[] },
  beforeStart: () => void = () => {},
) {
  const [state, setState] = createSignal(idlePlayback),
    [outputs, setOutputs] = createSignal<AudioOutput[]>([]),
    [discovering, setDiscovering] = createSignal(false),
    [device, setDevice] = createSignal(""),
    [selection, setSelection] = createSignal<PlayableSelection[]>([]),
    [error, setError] = createSignal(""),
    [busy, setBusy] = createSignal(false),
    [target, setTarget] = createSignal(""),
    [remaining, setRemaining] = createSignal(false),
    [policy, setPolicy] = createSignal("without-effects");
  const [audio, setAudio] = createSignal<AudioPreferences>({ ...defaultAudioPreferences });
  function restoreAudio() {
    try {
      const next = parseAudioPreferences(localStorage.getItem(audioPreferenceKey));
      setAudio(next);
      setPolicy(next.policy);
    } catch (failure) {
      setError(message(failure));
    }
  }
  restoreAudio();
  function saveAudio(next: AudioPreferences) {
    const raw = JSON.stringify(next);
    parseAudioPreferences(raw);
    localStorage.setItem(audioPreferenceKey, raw);
    setAudio(next);
    announceSetting(audioPreferenceKey, raw);
  }
  async function configureAudio() {
    if (device() === "@hqplayer") return;
    await playbackControl("crossfade", audio().crossfadeMs);
    await playbackControl("repeat", audio().repeat);
  }
  async function chooseCrossfade(ms: number) {
    if (busy()) return;
    try {
      const next = { ...audio(), crossfadeMs: ms, ...(ms > 0 ? { policy: "dsp" as const } : {}) };
      parseAudioPreferences(JSON.stringify(next));
      if (ms > 0 && policy() !== "dsp") await choosePolicy("dsp");
      if (ready() && device() !== "@hqplayer") await action("crossfade", ms);
      saveAudio(next);
    } catch (failure) {
      setError(message(failure));
    }
  }
  const progress = createSeekProgress(
    state,
    (position) => playbackControl("seek", position),
    setError,
  );
  let audibleVolume = 0.5,
    preferenceKey = "";
  function identify(key: string) {
    preferenceKey = `phemios.playback-time:${key}`;
    try {
      setRemaining(localStorage.getItem(preferenceKey) === "remaining");
    } catch {
      setError(t("Préférence de durée indisponible."));
    }
  }
  function toggleTime() {
    const next = !remaining();
    setRemaining(next);
    if (preferenceKey)
      try {
        localStorage.setItem(preferenceKey, next ? "remaining" : "duration");
        localStorage.setItem("phemios.duration", JSON.stringify(next));
        announceSetting("phemios.duration", JSON.stringify(next));
      } catch {
        setError(t("Préférence de durée non mémorisée."));
      }
  }
  async function choosePolicy(value: string) {
    if (!["without-effects", "dsp"].includes(value) || busy()) return;
    setPolicy(value);
    try {
      saveAudio({ ...audio(), policy: value as AudioPreferences["policy"] });
    } catch (failure) {
      setError(message(failure));
    }
    if (["playing", "paused"].includes(state().status)) await action("policy", value);
  }
  async function startReference(reference = target()) {
    if (!ready() || busy() || !reference || !catalog) return;
    beforeStart();
    const current = selection()[state().index];
    if (
      state().status === "paused" &&
      (current?.reference === reference || current?.album?.reference === reference)
    ) {
      await action("resume");
      return;
    }
    setBusy(true);
    setError("");
    cancel();
    const epoch = generation;
    try {
      const response = await requestAede("/api/v1/presentation/playback", { ref: reference });
      if (epoch !== generation) return;
      const data = catalog(),
        rows = playbackSelection(response, data.albums, data.artists);
      await configureAudio();
      if (epoch !== generation) return;
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
  async function startSelection(value: unknown) {
    if (!ready() || busy() || !catalog) return;
    beforeStart();
    setBusy(true);
    setError("");
    cancel();
    const epoch = generation;
    try {
      const data = catalog(),
        rows = playbackSelection(value, data.albums, data.artists);
      await configureAudio();
      if (epoch !== generation) return;
      await playbackStart(
        rows.map((row) => row.reference),
        device(),
        0,
        policy(),
      );
      if (epoch !== generation) return;
      setSelection(rows);
      await refresh(epoch);
    } catch (failure) {
      if (epoch === generation) {
        setError(message(failure));
        throw failure;
      }
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
        timer = setTimeout(
          () => void refresh(epoch),
          value.device === "@hqplayer" ? 250 : value.status === "playing" ? 60 : 250,
        );
    } catch (failure) {
      if (epoch === generation) setError(message(failure));
    }
  }
  async function action(command: string, value: unknown = null) {
    if (command === "seek" && typeof value === "number") return progress.seek(value);
    if (busy()) return;
    progress.reset();
    setBusy(true);
    setError("");
    cancel();
    const epoch = generation;
    try {
      await playbackControl(command, value);
      if (command === "repeat" && ["off", "one", "all"].includes(String(value)))
        saveAudio({ ...audio(), repeat: value as AudioPreferences["repeat"] });
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
    beforeStart();
    setBusy(true);
    setError("");
    cancel();
    const epoch = generation;
    try {
      if (!tracks.length || tracks.length > 4096 || index < 0 || index >= tracks.length)
        throw new Error(t("Sélection limitée à 4096 pistes."));
      await configureAudio();
      if (epoch !== generation) return;
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
  let discoveryTimer: ReturnType<typeof setTimeout> | undefined,
    finishDiscovery: (() => void) | undefined;
  function cancelDiscovery() {
    clearTimeout(discoveryTimer);
    finishDiscovery?.();
    discoveryTimer = undefined;
    finishDiscovery = undefined;
    setDiscovering(false);
  }
  async function discover() {
    if (!ready() || discovering()) return;
    const epoch = lifetime;
    setDiscovering(true);
    setError("");
    const minimum = new Promise<void>((resolve) => {
      finishDiscovery = resolve;
      discoveryTimer = setTimeout(resolve, 1000);
    });
    try {
      const value = parseOutputs(await playbackOutputs());
      if (epoch === lifetime) setOutputs(value);
    } catch (failure) {
      if (epoch === lifetime) setError(message(failure));
    } finally {
      await minimum;
      if (epoch === lifetime) cancelDiscovery();
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
    if (state().device === "@hqplayer") await action("mute");
    else await volume(state().volume > 0 ? 0 : audibleVolume);
  }
  async function chooseOutput(id: string) {
    if (busy()) return;
    const previous = device();
    setDevice(id);
    if (!["idle", "ended", "error"].includes(state().status)) {
      await action(id === "@hqplayer" || previous === "@hqplayer" ? "stop" : "output", id);
      if (error()) setDevice(previous);
    }
  }
  function reset() {
    if (typeof window !== "undefined")
      window.removeEventListener("phemios-settings-loaded", restoreAudio);
    progress.reset();
    lifetime++;
    cancelDiscovery();
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
  const restoreTime = () => {
    try {
      const next = localStorage.getItem("phemios.duration") === "true";
      setRemaining(next);
      if (preferenceKey) localStorage.setItem(preferenceKey, next ? "remaining" : "duration");
    } catch {
      setError(t("Préférence de durée indisponible."));
    }
  };
  if (typeof window !== "undefined")
    window.addEventListener("phemios-settings-loaded", restoreTime);
  if (typeof window !== "undefined")
    window.addEventListener("phemios-settings-loaded", restoreAudio);
  onCleanup(() => {
    if (typeof window !== "undefined")
      window.removeEventListener("phemios-settings-loaded", restoreTime);
    if (typeof window !== "undefined")
      window.removeEventListener("phemios-settings-loaded", restoreAudio);
    progress.reset();
    lifetime++;
    cancelDiscovery();
    cancel();
  });
  const queueOrder = createMemo(() => state().queue, undefined, {
    equals: (previous, next) =>
      previous.length === next.length && previous.every((index, offset) => index === next[offset]),
  });
  const orderedQueue = createMemo(() => {
    const rows = selection(),
      order = queueOrder();
    return (order.length ? order : rows.map((_, index) => index)).map((index) => ({
      ...rows[index]!,
      index,
    }));
  });
  return {
    seek: progress.seek,
    previewSeek: progress.preview,
    clearSeekPreview: progress.clearPreview,
    seekPosition: progress.position,
    seeking: progress.pending,
    target,
    setTarget,
    startReference,
    startSelection,
    identify,
    remaining,
    toggleTime,
    policy,
    choosePolicy,
    chooseCrossfade,
    crossfade: () => audio().crossfadeMs,
    toggleMute,
    state,
    outputs,
    discovering,
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
    queue: orderedQueue,
    current: () => {
      const row = selection()[state().index];
      return row?.reference === state().reference ? row : undefined;
    },
  };
}

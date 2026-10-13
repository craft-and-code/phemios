import { interfacePreferences, interfaceProfileIdentity } from "./account-preferences";
import {
  audioPreferenceKey,
  defaultAudioPreferences,
  parseAudioPreferences,
  type AudioPreferences,
} from "./audio-preferences";
import { announceSetting } from "./saved-settings";
import { t } from "../i18n";
import { batch, createMemo, createSignal, onCleanup, type Accessor } from "solid-js";
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
import { referenceSource, type SourceId } from "./sources";
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
    [retainedOrder, setRetainedOrder] = createSignal<readonly number[]>([]),
    [error, setError] = createSignal(""),
    [busy, setBusy] = createSignal(false),
    [target, setTarget] = createSignal(""),
    [pendingReference, setPendingReference] = createSignal(""),
    [pendingSource, setPendingSource] = createSignal<SourceId>(),
    [remaining, setRemaining] = createSignal(false),
    [policy, setPolicy] = createSignal("without-effects");
  const [audio, setAudio] = createSignal<AudioPreferences>({ ...defaultAudioPreferences });
  const [crossfade, setCrossfade] = createSignal(defaultAudioPreferences.crossfadeMs);
  function restoreAudio() {
    try {
      const next = parseAudioPreferences(interfacePreferences.getItem(audioPreferenceKey));
      setAudio(next);
      setCrossfade(next.crossfadeMs);
      setPolicy(next.policy);
    } catch (failure) {
      setError(message(failure));
    }
  }
  restoreAudio();
  function saveAudio(next: AudioPreferences) {
    const raw = JSON.stringify(next);
    parseAudioPreferences(raw);
    interfacePreferences.setItem(audioPreferenceKey, raw);
    setAudio(next);
    announceSetting(audioPreferenceKey, raw);
  }
  async function configureAudio() {
    if (device() === "@hqplayer") return;
    await playbackControl("crossfade", audio().crossfadeMs);
    await playbackControl("repeat", audio().repeat);
    await playbackControl("volume", state().volume);
  }
  let pendingCrossfade: { ms: number; lifetime: number; profile: object } | undefined,
    crossfadeRunning = false;
  async function chooseCrossfade(ms: number) {
    if (busy()) return;
    try {
      parseAudioPreferences(JSON.stringify({ ...audio(), crossfadeMs: ms }));
    } catch (failure) {
      setError(message(failure));
      return;
    }
    setCrossfade(ms);
    pendingCrossfade = { ms, lifetime, profile: interfaceProfileIdentity() };
    if (crossfadeRunning) return;
    crossfadeRunning = true;
    // Hot policy writes retain polling/focus and coalesce only not-yet-sent choices.
    try {
      while (pendingCrossfade) {
        const chosen = pendingCrossfade;
        pendingCrossfade = undefined;
        const current = () =>
          chosen.lifetime === lifetime && chosen.profile === interfaceProfileIdentity();
        if (!current()) continue;
        try {
          if (ready() && device() !== "@hqplayer") await playbackControl("crossfade", chosen.ms);
          if (current()) {
            saveAudio({ ...audio(), crossfadeMs: chosen.ms });
            setError("");
          }
        } catch (failure) {
          if (current()) {
            if (!pendingCrossfade) setCrossfade(audio().crossfadeMs);
            setError(message(failure));
          }
        }
      }
    } finally {
      crossfadeRunning = false;
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
        interfacePreferences.setItem("phemios.duration", JSON.stringify(next));
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
  async function startRows(rows: PlayableSelection[], index: number, epoch: number) {
    setPendingReference(rows[index]?.reference ?? rows[0]?.reference ?? "");
    await configureAudio();
    if (epoch !== generation) return;
    await playbackStart(
      rows.map((row) => row.reference),
      device(),
      index,
      policy(),
    );
    if (epoch !== generation) return;
    await refresh(epoch, rows);
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
    setPendingReference(reference);
    try {
      const response = await requestAede("/api/v1/presentation/playback", { ref: reference });
      if (epoch !== generation) return;
      const data = catalog(),
        rows = playbackSelection(response, data.albums, data.artists);
      await startRows(rows, 0, epoch);
    } catch (failure) {
      if (epoch === generation) setError(message(failure));
    } finally {
      if (epoch === generation) {
        setPendingReference("");
        setBusy(false);
      }
    }
  }
  async function startSelection(value: unknown) {
    return admitSelection(value);
  }
  /** A captured asynchronous selection shares playback admission; undefined means the read was canceled. */
  async function readSelection(
    load: (current: () => boolean) => Promise<unknown>,
    source: SourceId,
  ) {
    return admitSelection(undefined, load, source);
  }
  async function admitSelection(
    value: unknown,
    load?: (current: () => boolean) => Promise<unknown>,
    source?: SourceId,
  ) {
    if (!ready() || busy() || !catalog) return;
    beforeStart();
    setBusy(true);
    setError("");
    if (!load) cancel();
    let epoch = generation;
    setPendingSource(source);
    try {
      const resolved = load ? await load(() => epoch === generation) : value;
      if (epoch !== generation || (load && resolved === undefined)) return;
      if (load) {
        cancel();
        epoch = generation;
      }
      const data = catalog(),
        rows = playbackSelection(resolved, data.albums, data.artists);
      await startRows(rows, 0, epoch);
    } catch (failure) {
      if (epoch === generation) {
        setError(message(failure));
        throw failure;
      }
    } finally {
      if (epoch === generation) {
        setPendingReference("");
        setPendingSource(undefined);
        setBusy(false);
      }
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
  async function refresh(epoch: number, rows?: PlayableSelection[]) {
    try {
      const value = parsePlayback(await playbackState());
      if (epoch !== generation) return;
      const selected = rows ?? selection();
      if (value.queue.some((index) => index >= selected.length))
        throw new Error(t("File de lecture invalide."));
      // Queue consumers must never observe new metadata paired with old occurrence indices.
      batch(() => {
        if (rows) setSelection(rows);
        if (rows || value.queue.length)
          setRetainedOrder(value.queue.length ? value.queue : selected.map((_, index) => index));
        setState(value);
      });
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
      await startRows(
        tracks.map((track, offset) => ({
          reference: track.reference,
          title: track.title,
          album,
          artist,
          number: offset + 1,
          albumTotal: tracks.length,
        })),
        index,
        epoch,
      );
    } catch (failure) {
      if (epoch === generation) setError(message(failure));
    } finally {
      if (epoch === generation) {
        setPendingReference("");
        setBusy(false);
      }
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
    if (!Number.isFinite(value) || value < 0 || value > 1) return;
    if (!ready()) {
      if (value > 0) audibleVolume = value;
      setState((s) => ({ ...s, volume: value }));
      return;
    }
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
    progress.reset();
    lifetime++;
    cancelDiscovery();
    cancel();
    setBusy(false);
    pendingVolume = undefined;
    pendingCrossfade = undefined;
    setCrossfade(audio().crossfadeMs);
    batch(() => {
      setState({ ...idlePlayback, volume: state().volume });
      setSelection([]);
      setRetainedOrder([]);
      setPendingReference("");
      setPendingSource(undefined);
    });
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
      const next = interfacePreferences.getItem("phemios.duration") === "true";
      setRemaining(next);
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
    pendingCrossfade = undefined;
    cancelDiscovery();
    cancel();
  });
  const queueOrder = createMemo(() => state().queue, undefined, {
    equals: (previous, next) =>
      previous.length === next.length && previous.every((index, offset) => index === next[offset]),
  });
  // Keep occurrence objects resident even when native Jump briefly clears/replaces its order.
  const occurrences = createMemo(() => selection().map((row, index) => ({ ...row, index })));
  const orderedQueue = createMemo(() => {
    const rows = occurrences(),
      order = queueOrder();
    return (
      order.length
        ? order
        : retainedOrder().length
          ? retainedOrder()
          : rows.map((_, index) => index)
    ).map((index) => rows[index]!);
  });
  /** Replay retained order after Stop; active queues retain their native occurrence jump. */
  async function playQueueOccurrence(occurrence: number) {
    if (["playing", "paused", "connecting"].includes(state().status))
      return action("jump", occurrence);
    if (!ready() || busy() || !Number.isSafeInteger(occurrence)) return;
    const ordered = orderedQueue(),
      index = ordered.findIndex((row) => row.index === occurrence);
    if (index < 0 || !ordered.length || ordered.length > 4096) return;
    beforeStart();
    setBusy(true);
    setError("");
    cancel();
    const epoch = generation;
    try {
      await startRows(ordered, index, epoch);
    } catch (failure) {
      if (epoch === generation) setError(message(failure));
    } finally {
      if (epoch === generation) {
        setPendingReference("");
        setBusy(false);
      }
    }
  }
  /** Empty transport state must not impersonate a source after Stop or during admission. */
  const ownsSource = (source: SourceId) =>
    pendingSource() === source ||
    [state().reference, selection()[0]?.reference, pendingReference()].some(
      (reference) => !!reference && referenceSource(reference) === source,
    );
  return {
    ownsSource,
    playQueueOccurrence,
    seek: progress.seek,
    previewSeek: progress.preview,
    clearSeekPreview: progress.clearPreview,
    seekPosition: progress.position,
    seeking: progress.pending,
    target,
    setTarget,
    startReference,
    startSelection,
    readSelection,
    identify,
    remaining,
    toggleTime,
    policy,
    choosePolicy,
    chooseCrossfade,
    crossfade,
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

import { cdReference, cdSelection, type CdDisc } from "../cd/model";
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
  startCd,
  playbackAppend,
  playbackControl,
  playbackOutputs,
  playbackStart,
  playbackState,
  requestAede,
} from "../platform/desktop";
import { idlePlayback, parseOutputs, parsePlayback, type AudioOutput } from "./playback-state";
import type { AccountSession, Track } from "./server";
import { createSeekProgress } from "./seek-progress";
import { createAudioSettingQueue } from "./audio-setting-queue";
import {
  playbackSelection,
  queueAdditionSelection,
  type PlayableSelection,
} from "./playback-selection";
import type { Artist, Album } from "./types";
import { referenceSource, type SourceId } from "./sources";
const message = (failure: unknown) =>
  failure instanceof Error ? failure.message : t("Lecture indisponible.");
/** Explicit playback owns one serialized poll; it never starts during offline browsing. */
export function createPlayback(
  ready: Accessor<boolean>,
  catalog?: () => { albums: readonly Album[]; artists: readonly Artist[] },
  beforeStart: () => void = () => {},
  sessionFor?: (reference: string) => AccountSession | undefined,
  availableFor?: (reference: string) => boolean,
  localCd?: { native: Accessor<boolean>; allowed: Accessor<boolean> },
) {
  const nativeReady = () => localCd?.native() === true;
  const outputReady = () => ready() || nativeReady();
  const isCd = () => state().source === "cd" || !!cdReference(selection()[0]?.reference ?? "");
  const [state, setState] = createSignal(idlePlayback),
    [outputs, setOutputs] = createSignal<AudioOutput[]>([]),
    [discovering, setDiscovering] = createSignal(false),
    [device, setDevice] = createSignal(""),
    [selection, setSelection] = createSignal<PlayableSelection[]>([]),
    [retainedOrder, setRetainedOrder] = createSignal<readonly number[]>([]),
    [error, setError] = createSignal(""),
    [busy, setBusy] = createSignal(false),
    [appending, setAppending] = createSignal(false),
    [clearing, setClearing] = createSignal(false),
    [target, setTarget] = createSignal(""),
    [pendingReference, setPendingReference] = createSignal(""),
    [pendingSource, setPendingSource] = createSignal<SourceId>(),
    [remaining, setRemaining] = createSignal(false),
    [policy, setPolicy] = createSignal("without-effects");
  const [discTarget, setDiscTarget] = createSignal<CdDisc>();
  const [audio, setAudio] = createSignal<AudioPreferences>({ ...defaultAudioPreferences });
  const [crossfade, setCrossfade] = createSignal(defaultAudioPreferences.crossfadeMs);
  let audibleVolume = 0.5,
    volumeRevision = 0,
    volumeLifetime = 0,
    appliedCrossfade = defaultAudioPreferences.crossfadeMs,
    appliedRepeat = defaultAudioPreferences.repeat;
  function restoreAudio() {
    try {
      const next = parseAudioPreferences(interfacePreferences.getItem(audioPreferenceKey));
      setAudio(next);
      appliedRepeat = next.repeat;
      appliedCrossfade = next.crossfadeMs;
      setCrossfade(appliedCrossfade);
      setPolicy(next.policy);
      volumeRevision++;
      setState((current) => ({ ...current, volume: next.volume }));
      audibleVolume = next.volume > 0 ? next.volume : 0.5;
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
  async function configureAudio(epoch: number) {
    if (device() === "@hqplayer") return;
    await writeCrossfade.settled();
    if (epoch !== generation) return;
    await playbackControl("crossfade", appliedCrossfade);
    if (epoch !== generation) return;
    await playbackControl("repeat", appliedRepeat);
    if (epoch !== generation) return;
    // Startup gain and interactive volume must agree before the stream can begin.
    while (epoch === generation) {
      await writeVolume.settled();
      if (epoch !== generation) return;
      const revision = volumeRevision;
      await playbackControl("volume", state().volume);
      if (epoch !== generation) return;
      await writeVolume.settled();
      if (revision === volumeRevision) return;
    }
  }
  const audioSettingScope = () => ({ lifetime, profile: interfaceProfileIdentity() });
  const volumeSettingScope = () => ({
    lifetime: volumeLifetime,
    profile: interfaceProfileIdentity(),
  });
  let requestedVolume: (ReturnType<typeof volumeSettingScope> & { value: number }) | undefined;
  const writeCrossfade = createAudioSettingQueue(
    audioSettingScope,
    async (ms, current, pending) => {
      try {
        if (ready() && device() !== "@hqplayer") await playbackControl("crossfade", ms);
        if (current()) {
          appliedCrossfade = ms;
          saveAudio({ ...audio(), crossfadeMs: ms });
        }
      } catch (failure) {
        if (current() && !pending()) {
          setCrossfade(appliedCrossfade);
          setError(message(failure));
        }
      }
    },
  );
  async function chooseCrossfade(ms: number) {
    if (busy()) return;
    try {
      parseAudioPreferences(JSON.stringify({ ...audio(), crossfadeMs: ms }));
    } catch (failure) {
      setError(message(failure));
      return;
    }
    setError("");
    setCrossfade(ms);
    // Hot policy writes retain polling/focus and coalesce only not-yet-sent choices.
    await writeCrossfade(ms);
  }
  const progress = createSeekProgress(
    state,
    (position) => playbackControl("seek", position),
    setError,
  );
  let preferenceKey = "";
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
  /** Public cache visibility does not grant another source's session or playback permission. */
  function canStart(reference = target()) {
    if (cdReference(reference))
      return nativeReady() && localCd?.allowed() === true && device() !== "@hqplayer";
    if (!reference || !ready() || (availableFor && !availableFor(reference))) return false;
    return !sessionFor || ["user", "admin"].includes(sessionFor(reference)?.account.role ?? "");
  }
  async function startRows(rows: PlayableSelection[], index: number, epoch: number) {
    if (rows.some((row) => !canStart(row.reference))) throw new Error(t("Lecture indisponible."));
    // A new run may retain the same reference/index (HQPlayer has no queue ticket).
    // Retire unsent seeks before startup IO, rather than waiting for its first snapshot.
    progress.reset();
    setPendingReference(rows[index]?.reference ?? rows[0]?.reference ?? "");
    await configureAudio(epoch);
    if (epoch !== generation) return;
    if (rows.some((row) => !canStart(row.reference))) throw new Error(t("Lecture indisponible."));
    const disc = cdReference(rows[0]?.reference ?? "");
    if (disc) {
      if (rows.some((row) => cdReference(row.reference)?.token !== disc.token))
        throw new Error(t("Une file CD ne peut pas recevoir de pistes du catalogue."));
      await startCd(
        disc.token,
        rows.map((row) => row.reference),
        device(),
        index,
      );
    } else {
      await playbackStart(
        rows.map((row) => row.reference),
        device(),
        index,
        policy(),
      );
    }
    if (epoch !== generation) return;
    await refresh(epoch, rows);
  }
  /** Physical tracks share the same metadata publication and poll as the catalogue player. */
  async function startDisc(disc: CdDisc, index = 0) {
    const rows = cdSelection(disc);
    if (busy() || index < 0 || index >= rows.length || rows.some((row) => !canStart(row.reference)))
      return;
    beforeStart();
    setBusy(true);
    setError("");
    cancel();
    const epoch = generation;
    try {
      await startRows(rows, index, epoch);
    } catch (failure) {
      if (epoch === generation) setError(message(failure));
    } finally {
      if (epoch === generation) {
        setPendingReference("");
        setBusy(false);
      }
    }
  }
  async function startReference(reference = target()) {
    const cd = cdReference(reference);
    if (cd) {
      const disc = discTarget();
      if (!disc || disc.token !== cd.token) {
        setError(t("Le CD a changé. Actualisez la liste des lecteurs."));
        return;
      }
      return startDisc(
        disc,
        disc.tracks.findIndex((track) => track.reference === reference),
      );
    }
    if (!canStart(reference) || busy() || !catalog) return;
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
    if (!ready() || busy() || !catalog || (source && !canStart(`track:@phemios/${source}/queue`)))
      return;
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
  /** Append a captured source without replacing the live stream. A canonical track reference limits admission to that identity. */
  async function appendSelection(
    load: (current: () => boolean) => Promise<unknown>,
    source: SourceId,
    reference?: string,
  ) {
    if (isCd()) throw new Error(t("Une file CD ne peut pas recevoir de pistes du catalogue."));
    if (!canStart(`track:@phemios/${source}/queue`) || busy() || appending() || !catalog)
      throw new Error(t("Lecture indisponible."));
    if (device() === "@hqplayer")
      throw new Error(t("L’ajout à la file HQPlayer n’est pas pris en charge."));
    const ownerReference = `track:@phemios/${source}/queue`,
      owner = sessionFor?.(ownerReference);
    if (sessionFor && (!owner || owner.account.role === "auditor"))
      throw new Error(t("Votre compte ne permet pas la lecture."));
    const existing = selection();
    if (existing.length && referenceSource(existing[0]!.reference) !== source)
      throw new Error(t("Lecture de plusieurs origines non prise en charge dans une seule file."));
    const held = lifetime,
      profile = interfaceProfileIdentity(),
      ticket = ++addition;
    setAppending(true);
    const current = () =>
      held === lifetime &&
      ticket === addition &&
      selection() === existing &&
      profile === interfaceProfileIdentity() &&
      (!sessionFor || sessionFor(ownerReference) === owner);
    let pollingEpoch: number | undefined;
    try {
      const raw = await load(current);
      if (!current() || raw === undefined) return 0;
      if (!canStart(ownerReference)) throw new Error(t("Lecture indisponible."));
      if (device() === "@hqplayer")
        throw new Error(t("L’ajout à la file HQPlayer n’est pas pris en charge."));
      const data = catalog(),
        rows = queueAdditionSelection(raw, data.albums, data.artists, reference);
      if (
        rows.some((row) => referenceSource(row.reference) !== source) ||
        existing.length + rows.length > 4096
      )
        throw new Error(t("Sélection audio invalide ou trop volumineuse (4096 pistes maximum)."));
      if (busy()) throw new Error(t("Lecteur occupé, réessayez."));
      setBusy(true);
      const active = ["playing", "paused", "connecting"].includes(state().status);
      const next = [...existing, ...rows];
      cancel();
      pollingEpoch = generation;
      if (active)
        await playbackAppend(
          state().queue_id,
          existing.length,
          rows.map((row) => row.reference),
        );
      if (
        pollingEpoch !== generation ||
        profile !== interfaceProfileIdentity() ||
        (sessionFor && sessionFor(ownerReference) !== owner)
      )
        return 0;
      const order = [
        ...orderedQueue().map((row) => row.index),
        ...rows.map((_, index) => existing.length + index),
      ];
      batch(() => {
        setSelection(next);
        setRetainedOrder(order);
        setState((s) => ({ ...s, total: next.length, queue: order }));
      });
      if (active) await refresh(pollingEpoch);
      return rows.length;
    } finally {
      if (ticket === addition) setAppending(false);
      if (pollingEpoch === generation) {
        setBusy(false);
        if (!timer && ["playing", "paused", "connecting"].includes(state().status))
          void refresh(pollingEpoch);
      }
    }
  }
  /** Footer admission follows the queued source before the visible page; connecting has no second start. */
  function canTogglePlayback() {
    if (busy() || state().status === "connecting") return false;
    if (state().status === "playing") return true;
    if (state().status === "paused") return canStart(state().reference);
    return canStart(
      orderedQueue()[0]?.reference ?? (target() || discTarget()?.tracks[0]?.reference),
    );
  }
  /** Resume the prepared order before falling back to the page. Explicit contextual Play still replaces it. */
  async function togglePlayback() {
    if (!canTogglePlayback()) return;
    if (state().status === "playing") return action("pause");
    if (state().status === "paused") return action("resume");
    const first = orderedQueue()[0];
    if (first) return playQueueOccurrence(first.index);
    if (discTarget()) return startDisc(discTarget()!);
    return startReference();
  }
  /** Contextual additions reuse canonical expansion; failures surface through the existing player feedback. */
  async function appendReference(
    reference: string,
    load?: (current: () => boolean) => Promise<unknown>,
  ) {
    const held = lifetime,
      owner = sessionFor?.(reference);
    let current: (() => boolean) | undefined;
    setError("");
    try {
      return await appendSelection(
        (admitted) => {
          current = admitted;
          return load
            ? load(admitted)
            : requestAede("/api/v1/presentation/playback", { ref: reference });
        },
        referenceSource(reference),
        load ? undefined : reference,
      );
    } catch (failure) {
      if (
        held === lifetime &&
        (!current || current()) &&
        (!sessionFor || sessionFor(reference) === owner)
      )
        setError(message(failure));
      return 0;
    }
  }
  let timer: ReturnType<typeof setTimeout> | undefined,
    generation = 0,
    lifetime = 0,
    addition = 0;
  function cancel() {
    generation++;
    clearTimeout(timer);
    timer = undefined;
  }
  async function refresh(epoch: number, rows?: PlayableSelection[]) {
    if (epoch !== generation) return;
    try {
      const volumeTicket = volumeRevision;
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
        // A snapshot captured before an acknowledged gain write must not undo the footer's mute.
        const snapshot =
          volumeTicket === volumeRevision ? value : { ...value, volume: state().volume };
        if (snapshot.volume > 0) audibleVolume = snapshot.volume;
        setState(snapshot);
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
    if (
      ["resume", "jump", "next", "previous"].includes(command) &&
      !canStart(state().reference || selection()[0]?.reference || "")
    )
      return;
    if (busy()) return;
    if (command === "queue" && !["playing", "paused", "connecting"].includes(state().status)) {
      const edit = value as { queue_id?: unknown; order?: unknown } | null;
      const held = orderedQueue().map((row) => row.index),
        requested = edit?.order;
      if (
        edit?.queue_id !== state().queue_id ||
        !Array.isArray(requested) ||
        requested.length !== held.length ||
        new Set(requested).size !== held.length ||
        requested.some((index) => !held.includes(index))
      ) {
        setError(t("File de lecture invalide."));
        return;
      }
      batch(() => {
        setRetainedOrder(requested);
        setState((s) => ({ ...s, queue: requested, shuffled: false }));
      });
      return;
    }
    progress.reset();
    setBusy(true);
    setError("");
    cancel();
    const epoch = generation,
      profile = interfaceProfileIdentity();
    const currentProfile = () => epoch === generation && profile === interfaceProfileIdentity();
    try {
      await playbackControl(command, value);
      if (epoch !== generation) return;
      if (
        currentProfile() &&
        command === "repeat" &&
        ["off", "one", "all"].includes(String(value))
      ) {
        appliedRepeat = value as AudioPreferences["repeat"];
        saveAudio({ ...audio(), repeat: appliedRepeat });
      }
      await refresh(epoch);
      if (currentProfile()) return true;
    } catch (failure) {
      if (epoch === generation) {
        if (currentProfile()) setError(message(failure));
        // Playback can remain owned by the other connected source while the
        // interface profile changes. Resume its polling even for retired feedback.
        void refresh(epoch);
        if (currentProfile()) return false;
      }
    } finally {
      if (epoch === generation) setBusy(false);
    }
  }
  async function start(tracks: readonly Track[], album: Album, artist: string, index = 0) {
    if (!ready() || busy() || tracks.some((track) => !canStart(track.reference))) return;
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
    if (!outputReady() || discovering()) return;
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
  const writeVolume = createAudioSettingQueue(
    volumeSettingScope,
    async (value, current, pending) => {
      try {
        await playbackControl("volume", value);
        if (current()) {
          if (value > 0) audibleVolume = value;
          volumeRevision++;
          setState((s) => ({ ...s, volume: value }));
          saveAudio({ ...audio(), volume: value });
        }
      } catch (failure) {
        if (current() && !pending()) setError(message(failure));
      } finally {
        if (current() && !pending()) requestedVolume = undefined;
      }
    },
  );
  /** Browser media inherit the last admitted gain, including an unfinished native choice. */
  async function settledVolume() {
    await writeVolume.settled();
    return state().volume;
  }
  function rememberVolume(value: number) {
    if (!Number.isFinite(value) || value < 0 || value > 1) return;
    // A browser-media gain supersedes pending native writes and their unsent choices.
    volumeLifetime++;
    requestedVolume = undefined;
    if (value > 0) audibleVolume = value;
    volumeRevision++;
    setState((s) => ({ ...s, volume: value }));
    try {
      saveAudio({ ...audio(), volume: value });
    } catch (failure) {
      setError(message(failure));
    }
  }
  async function volume(value: number) {
    if (!Number.isFinite(value) || value < 0 || value > 1) return;
    if (!outputReady()) {
      rememberVolume(value);
      return;
    }
    requestedVolume = { ...volumeSettingScope(), value };
    await writeVolume(value);
  }
  async function toggleMute() {
    if (state().device === "@hqplayer") await action("mute");
    else {
      const intent = requestedVolume;
      const latest =
        intent?.lifetime === volumeLifetime && intent.profile === interfaceProfileIdentity()
          ? intent.value
          : state().volume;
      await volume(latest > 0 ? 0 : audibleVolume);
    }
  }
  async function chooseOutput(id: string) {
    if (busy()) return;
    const previous = device(),
      held = lifetime,
      profile = interfaceProfileIdentity();
    setDevice(id);
    // HQPlayer retains its queue after natural completion; retire that owner before PCM settings.
    if (state().device === "@hqplayer" || !["idle", "ended", "error"].includes(state().status)) {
      const applied = await action(
        id === "@hqplayer" || previous === "@hqplayer" || state().device === "@hqplayer"
          ? "stop"
          : "output",
        id,
      );
      if (
        applied === false &&
        held === lifetime &&
        profile === interfaceProfileIdentity() &&
        device() === id
      )
        setDevice(previous);
    }
  }
  /** Remove exactly one occurrence; only the currently removed stream may stop or advance. */
  async function removeOccurrence(occurrence: number) {
    const existing = selection(),
      order = orderedQueue().map((row) => row.index);
    if (busy() || !order.includes(occurrence) || state().device === "@hqplayer") return false;
    addition++;
    setAppending(false);
    progress.reset();
    cancel();
    const epoch = generation,
      id = state().queue_id,
      active = ["playing", "paused", "connecting"].includes(state().status);
    setBusy(true);
    setError("");
    try {
      const value = parsePlayback(
        await playbackControl(
          active ? "remove" : "clear",
          active ? { queue_id: id, index: occurrence } : null,
        ),
      );
      if (epoch !== generation) return false;
      if (
        active &&
        ((value.total > 0 && value.queue_id !== id) ||
          value.queue.length !== order.length - 1 ||
          value.queue.includes(occurrence) ||
          value.queue.some((index) => !order.includes(index)) ||
          (value.total && value.total !== existing.length))
      )
        throw new Error(t("File de lecture invalide."));
      if (
        !active &&
        (value.status !== "idle" || value.total || value.queue.length || value.reference)
      )
        throw new Error(t("File de lecture invalide."));
      batch(() => {
        if (active) {
          if (!value.total) setSelection([]);
          setRetainedOrder(value.queue);
          setState({ ...value, volume: state().volume });
        } else {
          const retained = order.filter((index) => index !== occurrence);
          const original = [...retained].sort((a, b) => a - b);
          const remaining = original.map((index) => existing[index]!);
          const remapped = new Map(original.map((index, slot) => [index, slot]));
          const next = retained.map((index) => remapped.get(index)!);
          setSelection(remaining);
          setRetainedOrder(next);
          setState({ ...value, total: remaining.length, queue: next, volume: state().volume });
        }
      });
      if (["playing", "paused", "connecting"].includes(value.status)) void refresh(epoch);
      return true;
    } catch (failure) {
      if (epoch === generation) {
        setError(message(failure));
        if (active) void refresh(epoch);
      }
      return false;
    } finally {
      if (epoch === generation) setBusy(false);
    }
  }
  /** Confirm native stop/clear before discarding occurrences; output/account preferences remain resident. */
  async function clearQueue() {
    if (busy() || !selection().length) return false;
    addition++;
    setAppending(false);
    progress.reset();
    cancel();
    const epoch = generation;
    setBusy(true);
    setClearing(true);
    setError("");
    try {
      const value = parsePlayback(await playbackControl("clear", null));
      if (epoch !== generation) return false;
      if (value.status !== "idle" || value.total || value.queue.length || value.reference)
        throw new Error(t("File de lecture invalide."));
      batch(() => {
        setSelection([]);
        setRetainedOrder([]);
        setPendingReference("");
        setPendingSource(undefined);
        setState({ ...value, volume: state().volume });
      });
      return true;
    } catch (failure) {
      if (epoch === generation) {
        setError(message(failure));
        if (["playing", "paused", "connecting"].includes(state().status)) void refresh(epoch);
      }
      return false;
    } finally {
      if (epoch === generation) {
        setBusy(false);
        setClearing(false);
      }
    }
  }
  let revocation: { epoch: number; pending: Promise<boolean> } | undefined;
  /** Revoke audio admission immediately, including an unfinished start. Native Clear also cancels pending HQPlayer activation. */
  function revoke(): Promise<boolean> {
    if (revocation?.epoch === generation) return revocation.pending;
    addition++;
    lifetime++;
    volumeLifetime++;
    progress.reset();
    cancelDiscovery();
    cancel();
    const epoch = generation;
    appliedRepeat = audio().repeat;
    appliedCrossfade = audio().crossfadeMs;
    setCrossfade(appliedCrossfade);
    batch(() => {
      setAppending(false);
      setBusy(true);
      setClearing(true);
      setError("");
      setSelection([]);
      setRetainedOrder([]);
      setPendingReference("");
      setPendingSource(undefined);
      setState({ ...idlePlayback, volume: state().volume });
      setTarget("");
    });
    const pending = clearRevoked(epoch);
    revocation = { epoch, pending };
    void pending.finally(() => {
      if (revocation?.pending === pending) revocation = undefined;
    });
    return pending;
  }
  async function clearRevoked(epoch: number) {
    try {
      // Unlike an ordinary queue edit, revocation must reach native audio even while busy or empty.
      const value = parsePlayback(await playbackControl("clear", null));
      if (epoch !== generation) return false;
      if (value.status !== "idle" || value.total || value.queue.length || value.reference)
        throw new Error(t("File de lecture invalide."));
      return true;
    } catch (failure) {
      if (epoch !== generation) return false;
      setError(message(failure));
      try {
        await playbackControl("stop", null);
      } catch {
        // Keep the first failure visible; metadata stays revoked regardless of native failure.
      }
      return false;
    } finally {
      if (epoch === generation) {
        setBusy(false);
        setClearing(false);
      }
    }
  }
  function reset() {
    setClearing(false);
    addition++;
    setAppending(false);
    progress.reset();
    lifetime++;
    volumeLifetime++;
    cancelDiscovery();
    cancel();
    setBusy(false);
    appliedRepeat = audio().repeat;
    appliedCrossfade = audio().crossfadeMs;
    setCrossfade(appliedCrossfade);
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
    volumeLifetime++;
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
    if (!outputReady() || busy() || !Number.isSafeInteger(occurrence)) return;
    const ordered = orderedQueue(),
      index = ordered.findIndex((row) => row.index === occurrence);
    if (
      index < 0 ||
      !ordered.length ||
      ordered.length > 4096 ||
      !canStart(ordered[index]?.reference ?? "")
    )
      return;
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
      (reference) =>
        !!reference && !cdReference(reference) && referenceSource(reference) === source,
    );
  return {
    isCd,
    setDiscTarget,
    startDisc,
    canStart,
    clearing,
    clearQueue,
    revoke,
    removeOccurrence,
    appending,
    appendSelection,
    appendReference,
    ownsSource,
    playQueueOccurrence,
    togglePlayback,
    canTogglePlayback,
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
    ready: outputReady,
    start,
    action,
    discover,
    chooseOutput,
    volume,
    settledVolume,
    /** Last confirmed positive gain of the current interface profile, shared by browser media. */
    unmutedVolume: () => audibleVolume,
    rememberVolume,
    reset,
    queue: orderedQueue,
    current: () => {
      const row = selection()[state().index];
      return row?.reference === state().reference ? row : undefined;
    },
  };
}

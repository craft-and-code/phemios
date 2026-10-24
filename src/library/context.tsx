import { activeNativeSessionConflict } from "./connection-recovery";
import { createNetworkAudio } from "../network-audio/controller";
import { prepareNetworkPlayback } from "../network-audio/local-handoff";
import { createDisplayAwake, anyAudioPlaying } from "./display-awake";
import { cdReference } from "../cd/model";
import { createAlbumLyrics } from "./album-lyrics";
import { createParentalAccess } from "./parental-access";
import { createParentalMedia } from "./parental-media";
import { createBackgroundPriority } from "./background-priority";
import { createRetainedSearch } from "./retained-search";
import { createQueueLyrics } from "./queue-lyrics-controller";
import { createCatalogWatch } from "./catalog-watch";
import { createCatalogBootstrap } from "./catalog-bootstrap";
import { annotateAlbum } from "./album-annotation";
import { createAnnotationLoader, parseAnnotation } from "./annotation-loading";
import { createSavedSettings } from "./saved-settings";
import { createTagPreferences } from "./tag-preferences";
import { createMissingCoverLoader } from "./missing-artwork";
import { missingCoverAede } from "../platform/desktop";
import { createMissingCatalog } from "./missing";
import { t } from "../i18n";
import { catalogOrigins, effectiveSource, referenceSource, type SourceId } from "./sources";
import { startLocal, stopLocal, localStatus, setRequestSource } from "../platform/desktop";
import {
  createContext,
  batch,
  untrack,
  createEffect,
  useContext,
  createSignal,
  createMemo,
  onMount,
  onCleanup,
  on,
  type ParentProps,
  type Accessor,
} from "solid-js";
import { createAccountPodcasts } from "../podcasts/account-store";
import { browserPodcastMedia, createPodcastPlayback } from "../podcasts/playback";
import { browserRadioMedia, createRadioPlayback } from "../radio/playback";
import { resolveRadio } from "../platform/desktop";
import { createPlayback } from "./playback";
import { connectionMonitor } from "./connection";
import { createJobs } from "./jobs";
import { requestAede } from "../platform/desktop";
import { createStore } from "solid-js/store";
import { demoAlbums, demoArtists } from "../demo/catalog";
import {
  artworkAede,
  cachedAede,
  clearServerCache as clearServerCacheNative,
  isNative,
  loginAede,
  restoreAedeSession,
  logoutAede,
  syncAede,
} from "../platform/desktop";
import { parseSnapshot, type AccountSession, type Snapshot, type Annotation } from "./server";
import type { Artist, Album } from "./types";
interface Library {
  displayAwake: ReturnType<typeof createDisplayAwake>;
  parental: ReturnType<typeof createParentalAccess>;
  queueLyrics: ReturnType<typeof createQueueLyrics>;
  albumLyrics: ReturnType<typeof createAlbumLyrics>;
  savedSettings: ReturnType<typeof createSavedSettings>;
  missing: ReturnType<typeof createMissingCatalog>;
  missingArtwork: {
    image: (row: import("./missing").MissingAlbum) => string | undefined;
    error: (row: import("./missing").MissingAlbum) => string | undefined;
    load: (row: import("./missing").MissingAlbum, retry?: boolean) => Promise<void>;
    status: (
      row: import("./missing").MissingAlbum,
    ) => ReturnType<ReturnType<typeof createMissingCoverLoader>["status"]>;
  };
  networkAudio: ReturnType<typeof createNetworkAudio>;
  player: ReturnType<typeof createPlayback>;
  radio: ReturnType<typeof createRadioPlayback>;
  podcast: ReturnType<typeof createPodcastPlayback>;
  podcastListened: ReturnType<typeof createAccountPodcasts>;
  podcastSubscriptions: ReturnType<typeof createAccountPodcasts>;
  tasks: ReturnType<typeof createJobs>;
  artists: Accessor<readonly Artist[]>;
  albums: Accessor<readonly Album[]>;
  demo: boolean;
  session: Accessor<AccountSession | undefined>;
  serverSession: Accessor<AccountSession | undefined>;
  localSession: Accessor<AccountSession | undefined>;
  source: Accessor<SourceId>;
  origins: Accessor<readonly SourceId[]>;
  advancedSearch: ReturnType<typeof createRetainedSearch>;
  trackSources: Accessor<readonly import("./combined-tracks").TrackSource[]>;
  chooseSource: (source: SourceId) => void;
  sessionFor: (reference: string) => AccountSession | undefined;
  enableLocal: () => Promise<void>;
  disableLocal: () => Promise<void>;
  busy: Accessor<boolean>;
  connected: Accessor<boolean>;
  error: Accessor<string>;
  snapshot: Accessor<Snapshot | undefined>;
  /** Public projection remains readable after logout, without private annotations. */
  publicSnapshot: (source: SourceId) => Snapshot | undefined;
  serverCache: Accessor<Snapshot | undefined>;
  serverCacheHidden: Accessor<boolean>;
  setServerCacheHidden: (hidden: boolean) => void;
  clearServerCache: () => Promise<void>;
  connect: (
    server: string,
    username: string,
    password: string,
    certificate?: number[],
  ) => Promise<void>;
  sync: (source?: SourceId) => Promise<void>;
  disconnect: () => Promise<void>;
  image: (reference: string, kind: string) => string | undefined;
  imageError: (reference: string, kind: string) => string | undefined;
  warmImage: (reference: string, kind: string) => Promise<void>;
  mediaProgress: Accessor<readonly [number, number]>;
  mediaErrors: Accessor<number>;
  updateAnnotation: (reference: string, value: Annotation | null) => void;
  annotations: Record<string, Annotation | undefined>;
  tagPreferences: ReturnType<typeof createTagPreferences>;
}
const Context = createContext<Library>();
/** Public catalog is cached; own annotations and session secrets remain separate. */
export function LibraryProvider(props: ParentProps) {
  const demo = !isNative();
  const [serverSnapshot, setServerSnapshot] = createSignal<Snapshot>(),
    [localSnapshot, setLocalSnapshot] = createSignal<Snapshot>(),
    [serverSession, setSession] = createSignal<AccountSession>(),
    [localSession, setLocalSession] = createSignal<AccountSession>(),
    [selectedSource, setSource] = createSignal<SourceId>("server"),
    [busy, setBusy] = createSignal(false),
    [connected, setConnected] = createSignal(false),
    [error, setError] = createSignal("");
  const [serverCacheHidden, setCacheHidden] = createSignal(false);
  const visibilityKey = "phemios.server-cache-hidden.v1";
  try {
    const saved = localStorage.getItem(visibilityKey);
    if (saved !== null && saved !== "true" && saved !== "false") throw new Error();
    setCacheHidden(saved === "true");
  } catch {
    setError(t("Réglage du cache serveur inaccessible."));
  }
  function setServerCacheHidden(hidden: boolean) {
    if (serverSession() || busy())
      throw new Error(t("Déconnectez le serveur avant de modifier son cache."));
    localStorage.setItem(visibilityKey, String(hidden));
    setCacheHidden(hidden);
    advancedSearch.reset();
  }
  async function clearServerCache() {
    if (serverSession() || busy() || disconnectingServer)
      throw new Error(t("Déconnectez le serveur avant de vider son cache."));
    const current = bootstrap.capture("server");
    setBusy(true);
    try {
      await clearServerCacheNative(current);
      if (current()) {
        setServerSnapshot(undefined);
        advancedSearch.reset();
        clearMedia("server");
        if (admittedSnapshot("local")) void warmCovers();
      }
    } finally {
      if (bootstrap.active()) setBusy(false);
    }
  }
  const sessionAt = (owner: SourceId) => (owner === "local" ? localSession() : serverSession());
  const rawSnapshot = (owner: SourceId) => (owner === "local" ? localSnapshot() : serverSnapshot());
  const parentalSync = new Set<SourceId>();
  const policyEpochs: Record<SourceId, number> = { local: 0, server: 0 };
  const [parentalEpoch, setParentalEpoch] = createSignal(0);
  const parental = createParentalAccess({
    session: sessionAt,
    source: () => source(),
    changed: (owner, status) => {
      if (status.policy.enabled && source() === owner && !radioGuard.owner()) radio.stop();
      stopControlledSource(owner);
      parentalSync.add(owner);
      clearMedia(owner);
      if (snapshot()) void warmCovers();
      setParentalEpoch((value) => value + 1);
    },
    unavailable: stopControlledSource,
  });
  const admitted = {
    local: createMemo(() => {
      const value = rawSnapshot("local");
      return parental.catalogVisible("local", value) ? value : undefined;
    }),
    server: createMemo(() => {
      const value = rawSnapshot("server"),
        account = serverSession();
      // Public data can survive logout, but never represent another connected authority.
      return (account || !serverCacheHidden()) &&
        (!account || value?.server === account.server) &&
        parental.catalogVisible("server", value)
        ? value
        : undefined;
    }),
  };
  const admittedSnapshot = (owner: SourceId) => admitted[owner]();
  function stopControlledSource(owner: SourceId) {
    policyEpochs[owner]++;
    if (source() === owner && !radioGuard.owner()) radio.stop();
    annotationsLoader.reset(owner);
    advancedSearch.reset();
    if (radioGuard?.applies(owner)) {
      radioGuard.stop();
      radio.stop();
    }
    if (podcastGuard?.applies(owner)) {
      podcastGuard.stop();
      podcast.stop();
    }
    if (player?.ownsSource(owner)) {
      void player.revoke();
    }
  }
  const origins = createMemo(() =>
    catalogOrigins(
      [
        ...(admittedSnapshot("local")?.artists ?? []),
        ...(admittedSnapshot("local")?.albums ?? []),
        ...(admittedSnapshot("server")?.artists ?? []),
        ...(admittedSnapshot("server")?.albums ?? []),
      ].map((row) => row.reference),
    ),
  );
  const trackSources = createMemo(() =>
    (["local", "server"] as const).flatMap((owner) => {
      const session = owner === "local" ? localSession() : serverSession();
      const snapshot = admittedSnapshot(owner);
      return session
        ? [
            {
              source: owner,
              identity: `${session.server}:${session.account.id}`,
              ...(snapshot ? { scannedAt: snapshot.scannedAt } : {}),
            },
          ]
        : [];
    }),
  );
  const advancedSearch = createRetainedSearch(
    () =>
      parental.viewScope() +
      JSON.stringify(
        trackSources().map((row) => [
          row.source,
          row.identity,
          row.scannedAt,
          (row.source === "local" ? localSession() : serverSession())?.nativeSession,
        ]),
      ),
  );
  const tagPreferences = createTagPreferences();
  const source = createMemo(() =>
    effectiveSource(
      selectedSource(),
      trackSources().map((row) => row.source),
      origins(),
    ),
  );
  createEffect(() => setRequestSource(source()));
  const session = () => (source() === "local" ? localSession() : serverSession());
  const sessionFor = (reference: string) =>
    cdReference(reference)
      ? undefined
      : referenceSource(reference) === "local"
        ? localSession()
        : serverSession();
  const snapshot = createMemo<Snapshot | undefined>(() => {
    const remote = admittedSnapshot("server"),
      local = admittedSnapshot("local");
    const base = remote ?? local;
    return base
      ? {
          ...base,
          artists: [...(local?.artists ?? []), ...(remote?.artists ?? [])],
          albums: [...(local?.albums ?? []), ...(remote?.albums ?? [])],
          ...(local?.tracks || remote?.tracks
            ? { tracks: [...(local?.tracks ?? []), ...(remote?.tracks ?? [])] }
            : {}),
          ...(local?.labels || remote?.labels
            ? { labels: [...(local?.labels ?? []), ...(remote?.labels ?? [])] }
            : {}),
        }
      : undefined;
  });
  function chooseSource(value: SourceId) {
    setRequestSource(value);
    setSource(value);
  }
  const [images, setImages] = createStore<Record<string, string | undefined>>({}),
    [imageErrors, setImageErrors] = createStore<Record<string, string | undefined>>({}),
    [annotations, setAnnotations] = createStore<Record<string, Annotation | undefined>>({});
  const [mediaProgress, setMediaProgress] = createSignal<readonly [number, number]>([0, 0]);
  const bootstrap = createCatalogBootstrap({
    session: (owner) => (owner === "local" ? localSession() : serverSession()),
    read: cachedAede,
    publish: (owner, cached) => {
      const value = parseSnapshot(cached);
      if (owner === "local") setLocalSnapshot(value);
      else setServerSnapshot(value);
    },
    failed: (failure) =>
      setError(failure instanceof Error ? failure.message : t("Cache inaccessible.")),
  });
  onCleanup(bootstrap.dispose);
  const connection = connectionMonitor(async () => {
    const current = serverSession();
    if (!current) throw new Error(t("Session absente."));
    const account = await requestAede<{ id: string; enabled: boolean }>(
      "/api/auth/v1/session",
      {},
      "GET",
      null,
      "server",
    );
    if (account.id !== current.account.id || !account.enabled)
      throw new Error(t("Session invalide."));
  }, setConnected);
  const savedSettings = createSavedSettings(session, source);
  const cdAllowed = () =>
    (["local", "server"] as const).every((owner) => {
      const account = sessionAt(owner);
      return (
        !account ||
        (["user", "admin"].includes(account.account.role) &&
          parental.available(owner) &&
          !parental.status(owner)?.policy.enabled)
      );
    });
  const player = createPlayback(
    () =>
      [localSession(), serverSession()].some(
        (value) => value && ["user", "admin"].includes(value.account.role),
      ),
    () => ({ albums: albums(), artists: artists() }),
    () => {
      radio.stop();
      podcast.stop();
    },
    sessionFor,
    (reference) => referenceSource(reference) === "local" || connected(),
    { native: isNative, allowed: cdAllowed },
  );
  createEffect(() => {
    if (!cdAllowed() && player.isCd()) void player.revoke();
  });
  const radioGuard = createParentalMedia({
    access: parental,
    source,
    session: sessionAt,
    stop: () => radio.stop(),
    error: setError,
  });
  const podcastGuard = createParentalMedia({
    access: parental,
    source,
    session: sessionAt,
    stop: () => podcast.stop(),
    error: setError,
  });
  const radio = createRadioPlayback(
    resolveRadio,
    async () => {
      podcast.stop();
      await prepareNetworkPlayback(
        player,
        t("Arrêtez la lecture de la bibliothèque avant de lancer la radio."),
      );
    },
    browserRadioMedia,
    player.settledVolume,
    radioGuard.authorize,
    player.rememberVolume,
    player.unmutedVolume,
  );
  const podcastListened = createAccountPodcasts(session, source);
  const podcast = createPodcastPlayback(
    async () => {
      radio.stop();
      await prepareNetworkPlayback(
        player,
        t("Arrêtez la lecture de la bibliothèque avant de lancer le podcast."),
      );
    },
    browserPodcastMedia,
    (feed, id) => {
      void podcastListened.mark(feed, id);
    },
    player.settledVolume,
    () => podcastListened.capture().current,
    podcastGuard.authorize,
    player.rememberVolume,
    player.unmutedVolume,
  );
  createEffect(() => radioGuard.observe(radio.status()));
  createEffect(() => podcastGuard.observe(podcast.status()));

  createEffect(on([session, source], () => podcast.stop(), { defer: true }));

  createEffect(() => {
    const account = session();
    if (account) player.identify(`${source()}:${account.server}:${account.account.id}`);
  });
  const tasks = createJobs(() => !!localSession() || !!serverSession(), {
    session: (source) => (source === "local" ? localSession() : serverSession()),
    changed: async (source) => {
      await sync(source);
    },
  });
  createBackgroundPriority({
    jobs: tasks.jobs,
    sessions: { local: localSession, server: serverSession },
    playing: () =>
      ["playing", "connecting"].includes(player.state().status) ||
      ["playing", "connecting"].includes(radio.status()) ||
      ["playing", "connecting"].includes(podcast.status()),
  });
  const displayAwake = createDisplayAwake({
    native: isNative(),
    playing: () => anyAudioPlaying(player.state().status, radio.status(), podcast.status()),
  });
  const networkAudio = createNetworkAudio({
    source,
    session: sessionAt,
    queue: player.queue,
    beforeStart: async () => {
      radio.stop();
      podcast.stop();
      await prepareNetworkPlayback(player, t("Arrêtez la lecture locale avant UPnP."));
    },
  });
  const queueLyrics = createQueueLyrics({ queue: player.queue, sessionFor, tasks });
  const albumLyrics = createAlbumLyrics({ sessionFor, tasks });
  const pending = new Map<string, Promise<void>>(),
    resident = new Map<string, HTMLImageElement>();
  let generation = 0;
  const artists = createMemo(() =>
    (snapshot()?.artists ?? (demo ? demoArtists : [])).map((artist) => {
      const personal = annotations[artist.reference];
      return personal
        ? {
            ...artist,
            searchFields: [
              ...(artist.searchFields ?? []),
              ...personal.tags,
              personal.note ?? "",
              personal.rating ? String(personal.rating) : "",
              personal.loved ? "favori" : "",
            ],
          }
        : artist;
    }),
  );
  const albums = createMemo(() =>
    (snapshot()?.albums ?? (demo ? demoAlbums : [])).map((album) =>
      annotateAlbum(album, annotations[album.reference]),
    ),
  );
  const key = (ref: string, kind: string) => `${kind}:${ref}`;
  const mediaEpochs: Record<SourceId, number> = { local: 0, server: 0 };
  let warming = 0;
  async function warmImage(reference: string, kind: string) {
    const id = key(reference, kind);
    if (images[id]) return;
    const held = pending.get(id);
    if (held) return held;
    const source = referenceSource(reference);
    const sourceEpoch = mediaEpochs[source];
    const epoch = generation;
    const current = () => epoch === generation && sourceEpoch === mediaEpochs[source];
    const work = (async () => {
      try {
        const bytes = await artworkAede(reference, kind);
        if (!current()) return;
        const data = new Uint8Array(bytes);
        const url = URL.createObjectURL(
          new Blob([data.buffer], { type: data[0] === 0x89 ? "image/png" : "image/jpeg" }),
        );
        const image = new Image();
        image.src = url;
        resident.set(id, image);
        setImages(id, url);
        setImageErrors(id, "");
      } catch (failure) {
        if (current())
          setImageErrors(id, failure instanceof Error ? failure.message : t("Image indisponible."));
      } finally {
        if (current()) pending.delete(id);
      }
    })();
    pending.set(id, work);
    await work;
  }
  function clearMedia(source?: SourceId) {
    warming++;
    setMediaProgress([0, 0]);
    if (source) {
      mediaEpochs[source]++;
      const belongs = (id: string) => referenceSource(id.slice(id.indexOf(":") + 1)) === source;
      for (const [id, url] of Object.entries(images)) {
        if (!belongs(id)) continue;
        if (url) URL.revokeObjectURL(url);
        setImages(id, undefined);
      }
      for (const id of Object.keys(imageErrors)) if (belongs(id)) setImageErrors(id, undefined);
      for (const id of resident.keys()) if (belongs(id)) resident.delete(id);
      for (const id of pending.keys()) if (belongs(id)) pending.delete(id);
      return;
    }
    generation++;
    for (const url of Object.values(images)) {
      if (url) URL.revokeObjectURL(url);
    }
    for (const id of Object.keys(images)) setImages(id, undefined);
    for (const id of Object.keys(imageErrors)) setImageErrors(id, undefined);
    resident.clear();
    pending.clear();
  }
  async function warmCovers() {
    const wave = ++warming;
    const queue = [
      ...artists()
        .filter((a) => a.media?.logo)
        .map((a) => ({ ref: a.reference, kind: "logo" })),
      ...albums()
        .filter((a) => a.cover)
        .map((a) => ({ ref: a.reference, kind: "cover" })),
      ...artists()
        .filter((a) => a.media?.portrait)
        .map((a) => ({ ref: a.reference, kind: "portrait" })),
      ...artists()
        .filter((a) => a.media?.banner)
        .map((a) => ({ ref: a.reference, kind: "banner" })),
      ...artists()
        .filter((a) => a.media?.background)
        .map((a) => ({ ref: a.reference, kind: "background" })),
    ];
    let done = 0,
      cursor = 0;
    const total = queue.length,
      epoch = generation;
    const current = () => epoch === generation && wave === warming;
    setMediaProgress([0, total]);
    await Promise.all(
      Array.from({ length: 1 }, async () => {
        while (cursor < queue.length && current()) {
          const row = queue[cursor++];
          if (!row) return;
          await warmImage(row.ref, row.kind);
          if (current()) setMediaProgress([++done, total]);
        }
      }),
    );
  }
  const annotationsLoader = createAnnotationLoader({
    session: (owner) => (owner === "local" ? localSession() : serverSession()),
    request: (owner, offset) =>
      requestAede(
        "/api/me/v1/annotations",
        { offset: String(offset), limit: "200" },
        "GET",
        null,
        owner,
      ),
    clear: (owner) =>
      batch(() => {
        for (const ref of Object.keys(annotations))
          if (referenceSource(ref) === owner) setAnnotations(ref, undefined);
      }),
    publish: (owner, rows) => {
      if (!parental.available(owner)) return;
      batch(() => {
        for (const row of rows) setAnnotations(row.reference, row);
      });
    },
    error: setError,
  });
  const annotationOwners: Record<SourceId, AccountSession | undefined> = {
    local: undefined,
    server: undefined,
  };
  createEffect(() => {
    const next = { local: localSession(), server: serverSession() };
    for (const owner of ["local", "server"] as const)
      if (annotationOwners[owner] !== next[owner]) {
        annotationOwners[owner] = next[owner];
        if (
          next[owner]?.account.parental_enabled === true &&
          source() === owner &&
          !radioGuard.owner()
        )
          radio.stop();
        untrack(() => {
          if (player.ownsSource(owner)) player.reset();
        });
        bootstrap.invalidate(owner);
        untrack(() => annotationsLoader.reset(owner));
      }
  });
  onCleanup(annotationsLoader.dispose);
  let synchronizing = false;
  let synchronizationDone: Promise<void> = Promise.resolve();
  async function sync(owner: SourceId = source()) {
    const expected = sessionAt(owner);
    while (synchronizing) {
      await synchronizationDone;
      if (!bootstrap.active() || sessionAt(owner) !== expected) return;
    }
    if (bootstrap.active()) await synchronize(owner, false);
  }
  async function synchronize(owner: SourceId, background: boolean): Promise<boolean> {
    if (!bootstrap.active() || busy() || synchronizing) return false;
    synchronizing = true;
    let complete = () => {};
    synchronizationDone = new Promise<void>((resolve) => {
      complete = resolve;
    });
    const current = bootstrap.capture(owner);
    if (!background) {
      setBusy(true);
      setError("");
    }
    try {
      await parental.refresh(owner);
      if (!current() || !parental.available(owner)) return false;
      parentalSync.delete(owner);
      const policyEpoch = policyEpochs[owner];
      const raw = await syncAede(owner);
      if (!current() || policyEpochs[owner] !== policyEpoch || !parental.available(owner))
        return false;
      const value = parseSnapshot(raw);
      if (!parental.catalogVisible(owner, value))
        throw Error(t("Catalogue supervisé à actualiser. Synchronisez la bibliothèque."));
      clearMedia(owner);
      if (owner === "local") setLocalSnapshot(value);
      else setServerSnapshot(value);
      // Public artwork must not wait for private annotations or strand the other source on logout.
      void warmCovers();
      await annotationsLoader.load(owner);
      return current() && policyEpochs[owner] === policyEpoch && parental.available(owner);
    } catch (failure) {
      if (current())
        setError(failure instanceof Error ? failure.message : t("Synchronisation impossible."));
      return false;
    } finally {
      synchronizing = false;
      complete();
      if (!background) setBusy(false);
    }
  }
  createCatalogWatch({
    session: sessionAt,
    busy: () => busy() || synchronizing,
    read: (owner, session) => requestAede("/api/v1/library", {}, "GET", null, owner, session),
    refresh: (owner) => synchronize(owner, true),
  });
  createEffect(() => {
    parentalEpoch();
    if (!busy()) {
      const next = [...parentalSync].find((owner) => sessionAt(owner));
      if (next) void sync(next);
    }
  });
  let disconnectingServer = false;
  async function connect(
    server: string,
    username: string,
    password: string,
    certificate?: number[],
  ) {
    if (!bootstrap.active() || busy() || disconnectingServer) return;
    bootstrap.invalidate("server");
    setBusy(true);
    setError("");
    let authenticated = false;
    try {
      // Revoke and halt the previous server account before admitting new credentials.
      if (serverSession()) await releaseServer();
      if (!bootstrap.active()) return;
      const account = await loginAede(server, username, password, certificate);
      // Native process ownership may survive a frontend reload; this retired context must not resume.
      if (!bootstrap.active()) return;
      setSession(account);
      authenticated = true;
      connection.start();
    } catch (failure) {
      if (!bootstrap.active()) return;
      let message = failure instanceof Error ? failure.message : t("Connexion impossible.");
      if (activeNativeSessionConflict(failure)) {
        try {
          const retained = await restoreAedeSession("server");
          if (retained && bootstrap.active() && !disconnectingServer && !serverSession()) {
            setSession(retained);
            connection.start();
          }
        } catch (recovery) {
          message += `\n${recovery instanceof Error ? recovery.message : String(recovery)}`;
        }
      }
      if (bootstrap.active()) setError(message);
    } finally {
      setBusy(false);
    }
    if (authenticated && serverSession()) await sync("server");
  }
  async function releaseServer() {
    bootstrap.invalidate("server");
    batch(() => {
      setError("");
      connection.stop();
      setSession(undefined);
      annotationsLoader.reset("server");
    });
    try {
      await logoutAede();
    } finally {
      connection.stop();
      if (player.ownsSource("server")) player.reset();
      setSession(undefined);
    }
  }
  async function disconnect() {
    if (disconnectingServer) return;
    disconnectingServer = true;
    try {
      await releaseServer();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : t("Déconnexion interrompue."));
    } finally {
      disconnectingServer = false;
    }
  }
  let startingLocal = false,
    localOperation = 0;
  async function enableLocal() {
    if (!bootstrap.active() || startingLocal) return;
    startingLocal = true;
    const operation = ++localOperation;
    const current = () => bootstrap.active() && operation === localOperation;
    bootstrap.invalidate("local");
    setError("");
    try {
      const account = await startLocal();
      if (!current()) return;
      setLocalSession(account);
      if (!serverSession()) chooseSource("local");
      await sync("local");
    } catch (failure) {
      if (current())
        setError(failure instanceof Error ? failure.message : t("Moteur local indisponible."));
    } finally {
      startingLocal = false;
    }
  }
  async function disableLocal() {
    // A late shutdown reply must not clear a newer local login or its feedback.
    const operation = ++localOperation;
    const current = () => bootstrap.active() && operation === localOperation;
    bootstrap.invalidate("local");
    setLocalSession(undefined);
    annotationsLoader.reset("local");
    try {
      await stopLocal();
      if (!current()) return;
      setLocalSession(undefined);
      if (player.ownsSource("local")) player.reset();
      if (source() === "local") chooseSource("server");
    } catch (failure) {
      if (current())
        setError(failure instanceof Error ? failure.message : t("Arrêt local impossible."));
    }
  }
  onMount(async () => {
    if (demo) return;
    let admitted = false;
    for (const owner of ["server", "local"] as const)
      admitted = (await bootstrap.load(owner)) || admitted;
    if (!bootstrap.active()) return;
    if (admitted) void warmCovers();
    for (const owner of ["server", "local"] as const) {
      const restored = await bootstrap.restoreSession(
        owner,
        restoreAedeSession,
        (source, session) => {
          if (source === "server") {
            setSession(session);
            connection.start();
          } else {
            setLocalSession(session);
            if (!serverSession()) chooseSource("local");
          }
        },
      );
      if (restored && bootstrap.active()) await sync(owner);
    }
    if (!bootstrap.unused("local")) return;
    try {
      const status = await localStatus();
      if (bootstrap.unused("local") && status.enabled) await enableLocal();
    } catch (failure) {
      if (bootstrap.unused("local"))
        setError(failure instanceof Error ? failure.message : t("Cache inaccessible."));
    }
  });
  onCleanup(() => {
    connection.stop();
    clearMedia();
  });
  const missing = createMissingCatalog(localSession, serverSession, admittedSnapshot);
  const [missingImageVersion, bumpMissingImages] = createSignal(0);
  const missingArtwork = createMissingCoverLoader(
    sessionFor,
    missing.supportsCover,
    missingCoverAede,
    () => bumpMissingImages((v) => v + 1),
  );
  createEffect(() => {
    localSession();
    serverSession();
    missingArtwork.prune();
  });
  onCleanup(missingArtwork.dispose);

  const value: Library = {
    parental,
    savedSettings,
    queueLyrics,
    albumLyrics,
    missing,
    missingArtwork: {
      image: (row) => {
        missingImageVersion();
        return missingArtwork.image(row);
      },
      error: (row) => {
        missingImageVersion();
        return missingArtwork.error(row);
      },
      load: missingArtwork.load,
      status: (row) => {
        missingImageVersion();
        return missingArtwork.status(row);
      },
    },
    tasks,
    displayAwake,
    radio,
    podcast,
    podcastListened,
    podcastSubscriptions: {
      ...podcastListened,
      feeds: () => podcastListened.feeds().filter((feed) => parental.podcastAllowed(feed.url)),
    },
    networkAudio,
    player,
    artists,
    albums,
    demo,
    session,
    serverSession,
    localSession,
    source,
    origins,
    advancedSearch,
    trackSources,
    chooseSource,
    sessionFor,
    enableLocal,
    disableLocal,
    busy,
    connected,
    error,
    snapshot,
    publicSnapshot: admittedSnapshot,
    serverCache: serverSnapshot,
    serverCacheHidden,
    setServerCacheHidden,
    clearServerCache,
    connect,
    sync,
    disconnect,
    image: (ref, kind) =>
      admittedSnapshot(referenceSource(ref)) ? images[key(ref, kind)] : undefined,
    imageError: (ref, kind) => imageErrors[key(ref, kind)],
    warmImage,
    mediaProgress,
    mediaErrors: () => Object.values(imageErrors).filter(Boolean).length,
    annotations,
    tagPreferences,
    updateAnnotation: (ref, value) => {
      if (!sessionFor(ref) || !parental.available(referenceSource(ref))) return;
      const checked = value === null ? null : parseAnnotation(value, ref);
      annotationsLoader.updated(ref, checked);
      setAnnotations(ref, checked ?? undefined);
    },
  };
  return <Context.Provider value={value}>{props.children}</Context.Provider>;
}
export function useLibrary(): Library {
  const context = useContext(Context);
  if (!context) throw new Error("LibraryProvider manquant.");
  return context;
}

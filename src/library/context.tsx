import { createQueueLyrics } from "./queue-lyrics-controller";
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
  createEffect,
  useContext,
  createSignal,
  createMemo,
  onMount,
  onCleanup,
  type ParentProps,
  type Accessor,
} from "solid-js";
import { createListenedEpisodes } from "../podcasts/listened";
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
  isNative,
  loginAede,
  logoutAede,
  syncAede,
} from "../platform/desktop";
import { parseSnapshot, type AccountSession, type Snapshot, type Annotation } from "./server";
import type { Artist, Album } from "./types";
interface Library {
  queueLyrics: ReturnType<typeof createQueueLyrics>;
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
  player: ReturnType<typeof createPlayback>;
  radio: ReturnType<typeof createRadioPlayback>;
  podcast: ReturnType<typeof createPodcastPlayback>;
  podcastListened: ReturnType<typeof createListenedEpisodes>;
  tasks: ReturnType<typeof createJobs>;
  artists: Accessor<readonly Artist[]>;
  albums: Accessor<readonly Album[]>;
  demo: boolean;
  session: Accessor<AccountSession | undefined>;
  serverSession: Accessor<AccountSession | undefined>;
  localSession: Accessor<AccountSession | undefined>;
  source: Accessor<SourceId>;
  origins: Accessor<readonly SourceId[]>;
  trackSources: Accessor<readonly import("./combined-tracks").TrackSource[]>;
  chooseSource: (source: SourceId) => void;
  sessionFor: (reference: string) => AccountSession | undefined;
  enableLocal: () => Promise<void>;
  disableLocal: () => Promise<void>;
  busy: Accessor<boolean>;
  connected: Accessor<boolean>;
  error: Accessor<string>;
  snapshot: Accessor<Snapshot | undefined>;
  connect: (server: string, username: string, password: string) => Promise<void>;
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
  const origins = createMemo(() =>
    catalogOrigins(
      [
        ...(localSnapshot()?.artists ?? []),
        ...(localSnapshot()?.albums ?? []),
        ...(serverSnapshot()?.artists ?? []),
        ...(serverSnapshot()?.albums ?? []),
      ].map((row) => row.reference),
    ),
  );
  const trackSources = createMemo(() =>
    (["local", "server"] as const).flatMap((owner) => {
      const session = owner === "local" ? localSession() : serverSession();
      const snapshot = owner === "local" ? localSnapshot() : serverSnapshot();
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
    referenceSource(reference) === "local" ? localSession() : serverSession();
  const snapshot = createMemo<Snapshot | undefined>(() => {
    const remote = serverSnapshot(),
      local = localSnapshot();
    const base = remote ?? local;
    return base
      ? {
          ...base,
          artists: [...(local?.artists ?? []), ...(remote?.artists ?? [])],
          albums: [...(local?.albums ?? []), ...(remote?.albums ?? [])],
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
  );
  const radio = createRadioPlayback(
    resolveRadio,
    async () => {
      podcast.stop();
      if (["playing", "paused", "connecting"].includes(player.state().status)) {
        await player.action("stop");
        if (["playing", "paused", "connecting"].includes(player.state().status))
          throw new Error(t("Arrêtez la lecture de la bibliothèque avant de lancer la radio."));
      }
    },
    browserRadioMedia,
    () => player.state().volume,
  );
  const podcastListened = createListenedEpisodes();
  const podcast = createPodcastPlayback(
    async () => {
      radio.stop();
      if (["playing", "paused", "connecting"].includes(player.state().status)) {
        await player.action("stop");
        if (["playing", "paused", "connecting"].includes(player.state().status))
          throw new Error(t("Arrêtez la lecture de la bibliothèque avant de lancer le podcast."));
      }
    },
    browserPodcastMedia,
    podcastListened.mark,
    () => player.state().volume,
  );

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
  const queueLyrics = createQueueLyrics({ queue: player.queue, sessionFor, tasks });
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
    (snapshot()?.albums ?? (demo ? demoAlbums : [])).map((album) => {
      const personal = annotations[album.reference];
      return personal
        ? {
            ...album,
            tags: [...album.tags, ...personal.tags],
            note: personal.note ?? "",
            ...(personal.rating ? { rating: personal.rating } : {}),
            favourite: personal.loved,
          }
        : album;
    }),
  );
  const key = (ref: string, kind: string) => `${kind}:${ref}`;
  async function warmImage(reference: string, kind: string) {
    const id = key(reference, kind);
    if (images[id]) return;
    const held = pending.get(id);
    if (held) return held;
    const epoch = generation;
    const work = (async () => {
      try {
        const bytes = await artworkAede(reference, kind);
        if (epoch !== generation) return;
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
        if (epoch === generation)
          setImageErrors(id, failure instanceof Error ? failure.message : t("Image indisponible."));
      } finally {
        pending.delete(id);
      }
    })();
    pending.set(id, work);
    await work;
  }
  function clearMedia() {
    generation++;
    for (const url of Object.values(images)) {
      if (url) URL.revokeObjectURL(url);
    }
    for (const id of Object.keys(images)) setImages(id, undefined);
    for (const id of Object.keys(imageErrors)) setImageErrors(id, undefined);
    resident.clear();
    pending.clear();
    setMediaProgress([0, 0]);
  }
  async function warmCovers() {
    const queue = [
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
    let done = 0;
    const total = queue.length,
      epoch = generation;
    setMediaProgress([0, total]);
    await Promise.all(
      Array.from({ length: 1 }, async () => {
        while (queue.length && epoch === generation) {
          const row = queue.shift();
          if (!row) return;
          await warmImage(row.ref, row.kind);
          if (epoch === generation) setMediaProgress([++done, total]);
        }
      }),
    );
  }
  async function loadAnnotations(owner: SourceId) {
    const current = () => (owner === "local" ? localSession() : serverSession());
    const account = current()?.account.id;
    let offset = 0;
    try {
      while (account && account === current()?.account.id) {
        const page = await requestAede<{ items: Annotation[]; total: number }>(
          "/api/me/v1/annotations",
          { offset: String(offset), limit: "200" },
          "GET",
          null,
          owner,
        );
        if (account !== current()?.account.id) return;
        for (const row of page.items) setAnnotations(row.reference, row);
        offset += page.items.length;
        if (offset >= page.total) return;
        if (!page.items.length) throw new Error(t("Pagination des annotations incohérente."));
      }
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : t("Annotations indisponibles."));
    }
  }
  async function sync(owner: SourceId = source()) {
    if (busy()) return;
    setBusy(true);
    setError("");
    try {
      const value = parseSnapshot(await syncAede(owner));
      clearMedia();
      if (owner === "local") setLocalSnapshot(value);
      else setServerSnapshot(value);
      await loadAnnotations(owner);
      void warmCovers();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : t("Synchronisation impossible."));
    } finally {
      setBusy(false);
    }
  }
  async function connect(server: string, username: string, password: string) {
    if (busy()) return;
    setBusy(true);
    setError("");
    try {
      setSession(await loginAede(server, username, password));
      connection.start();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : t("Connexion impossible."));
    } finally {
      setBusy(false);
    }
    if (serverSession()) await sync("server");
  }
  async function disconnect() {
    setError("");
    try {
      await logoutAede();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : t("Déconnexion interrompue."));
    } finally {
      connection.stop();
      if (referenceSource(player.state().reference) === "server") player.reset();
      setSession(undefined);
      for (const ref of Object.keys(annotations))
        if (referenceSource(ref) === "server") setAnnotations(ref, undefined);
    }
  }
  async function enableLocal() {
    setError("");
    try {
      setLocalSession(await startLocal());
      if (!serverSession()) chooseSource("local");
      await sync("local");
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : t("Moteur local indisponible."));
    }
  }
  async function disableLocal() {
    try {
      await stopLocal();
      setLocalSession(undefined);
      if (referenceSource(player.state().reference) === "local") player.reset();
      for (const ref of Object.keys(annotations))
        if (referenceSource(ref) === "local") setAnnotations(ref, undefined);
      if (source() === "local") chooseSource("server");
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : t("Arrêt local impossible."));
    }
  }
  onMount(async () => {
    if (demo) return;
    try {
      for (const owner of ["server", "local"] as const) {
        const cached = await cachedAede(owner);
        if (cached) {
          if (owner === "local") setLocalSnapshot(parseSnapshot(cached));
          else setServerSnapshot(parseSnapshot(cached));
        }
      }
      void warmCovers();
      if ((await localStatus()).enabled) await enableLocal();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : t("Cache inaccessible."));
    }
  });
  onCleanup(() => {
    connection.stop();
    clearMedia();
  });
  const missing = createMissingCatalog(localSession, serverSession, snapshot);
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
    savedSettings,
    queueLyrics,
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
    radio,
    podcast,
    podcastListened,
    player,
    artists,
    albums,
    demo,
    session,
    serverSession,
    localSession,
    source,
    origins,
    trackSources,
    chooseSource,
    sessionFor,
    enableLocal,
    disableLocal,
    busy,
    connected,
    error,
    snapshot,
    connect,
    sync,
    disconnect,
    image: (ref, kind) => images[key(ref, kind)],
    imageError: (ref, kind) => imageErrors[key(ref, kind)],
    warmImage,
    mediaProgress,
    mediaErrors: () => Object.values(imageErrors).filter(Boolean).length,
    annotations,
    tagPreferences,
    updateAnnotation: (ref, value) => setAnnotations(ref, value ?? undefined),
  };
  return <Context.Provider value={value}>{props.children}</Context.Provider>;
}
export function useLibrary(): Library {
  const context = useContext(Context);
  if (!context) throw new Error("LibraryProvider manquant.");
  return context;
}

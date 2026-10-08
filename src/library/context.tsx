import {
  createContext,
  useContext,
  createSignal,
  createMemo,
  onMount,
  onCleanup,
  type ParentProps,
  type Accessor,
} from "solid-js";
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
  player: ReturnType<typeof createPlayback>;
  tasks: ReturnType<typeof createJobs>;
  artists: Accessor<readonly Artist[]>;
  albums: Accessor<readonly Album[]>;
  demo: boolean;
  session: Accessor<AccountSession | undefined>;
  busy: Accessor<boolean>;
  connected: Accessor<boolean>;
  error: Accessor<string>;
  snapshot: Accessor<Snapshot | undefined>;
  connect: (server: string, username: string, password: string) => Promise<void>;
  sync: () => Promise<void>;
  disconnect: () => Promise<void>;
  image: (reference: string, kind: string) => string | undefined;
  imageError: (reference: string, kind: string) => string | undefined;
  warmImage: (reference: string, kind: string) => Promise<void>;
  mediaProgress: Accessor<readonly [number, number]>;
  mediaErrors: Accessor<number>;
  updateAnnotation: (reference: string, value: Annotation | null) => void;
  annotations: Record<string, Annotation | undefined>;
}
const Context = createContext<Library>();
/** Public catalog is cached; own annotations and session secrets remain separate. */
export function LibraryProvider(props: ParentProps) {
  const demo = !isNative();
  const [snapshot, setSnapshot] = createSignal<Snapshot>(),
    [session, setSession] = createSignal<AccountSession>(),
    [busy, setBusy] = createSignal(false),
    [connected, setConnected] = createSignal(false),
    [error, setError] = createSignal("");
  const [images, setImages] = createStore<Record<string, string | undefined>>({}),
    [imageErrors, setImageErrors] = createStore<Record<string, string | undefined>>({}),
    [annotations, setAnnotations] = createStore<Record<string, Annotation | undefined>>({});
  const [mediaProgress, setMediaProgress] = createSignal<readonly [number, number]>([0, 0]);
  const connection = connectionMonitor(async () => {
    const current = session();
    if (!current) throw new Error("Session absente.");
    const account = await requestAede<{ id: string; enabled: boolean }>("/api/auth/v1/session");
    if (account.id !== current.account.id || !account.enabled) throw new Error("Session invalide.");
  }, setConnected);
  const player = createPlayback(
    () => connected() && ["user", "admin"].includes(session()?.account.role ?? ""),
  );
  const tasks = createJobs(() => !!session());
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
          setImageErrors(id, failure instanceof Error ? failure.message : "Image indisponible.");
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
  async function loadAnnotations() {
    const account = session()?.account.id;
    let offset = 0;
    try {
      while (account && account === session()?.account.id) {
        const page = await requestAede<{ items: Annotation[]; total: number }>(
          "/api/me/v1/annotations",
          { offset: String(offset), limit: "200" },
        );
        if (account !== session()?.account.id) return;
        for (const row of page.items) setAnnotations(row.reference, row);
        offset += page.items.length;
        if (offset >= page.total) return;
        if (!page.items.length) throw new Error("Pagination des annotations incohérente.");
      }
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Annotations indisponibles.");
    }
  }
  async function sync() {
    if (busy()) return;
    setBusy(true);
    setError("");
    try {
      const value = parseSnapshot(await syncAede());
      clearMedia();
      setSnapshot(value);
      if (session()) await loadAnnotations();
      void warmCovers();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Synchronisation impossible.");
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
      setError(failure instanceof Error ? failure.message : "Connexion impossible.");
    } finally {
      setBusy(false);
    }
    if (session()) await sync();
  }
  async function disconnect() {
    setError("");
    try {
      await logoutAede();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Déconnexion interrompue.");
    } finally {
      connection.stop();
      player.reset();
      setSession(undefined);
      for (const ref of Object.keys(annotations)) setAnnotations(ref, undefined);
    }
  }
  onMount(async () => {
    if (demo) return;
    try {
      const cached = await cachedAede();
      if (cached) {
        setSnapshot(parseSnapshot(cached));
        void warmCovers();
      }
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Cache inaccessible.");
    }
  });
  onCleanup(() => {
    connection.stop();
    clearMedia();
  });
  const value: Library = {
    tasks,
    player,
    artists,
    albums,
    demo,
    session,
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
    updateAnnotation: (ref, value) => setAnnotations(ref, value ?? undefined),
  };
  return <Context.Provider value={value}>{props.children}</Context.Provider>;
}
export function useLibrary(): Library {
  const context = useContext(Context);
  if (!context) throw new Error("LibraryProvider manquant.");
  return context;
}

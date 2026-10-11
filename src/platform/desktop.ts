import { wikipediaDocument } from "../encyclopedia/document";
import { t } from "../i18n";
import { referenceSource, type SourceId } from "../library/sources";
import { invoke, isTauri } from "@tauri-apps/api/core";

/** Versioned bridge metadata; no music folders or credentials are exposed. */
export interface RuntimeInfo {
  bridgeVersion: number;
  name: string;
  version: string;
  native: boolean;
}

/** Browser previews stay offline and report their lack of native capabilities. */
export async function getRuntimeInfo(): Promise<RuntimeInfo> {
  if (!isTauri()) {
    return { bridgeVersion: 1, name: "Phémios", version: "0.1.0", native: false };
  }
  const info = await invoke<RuntimeInfo>("runtime_info");
  if (info.bridgeVersion !== 1) {
    throw new Error(t("Incompatible Phémios desktop bridge. Update the application."));
  }
  return info;
}

/** All native data operations carry the bridge version and stay on typed IPC. */
export const isNative = () => isTauri();
async function nativeCall<T>(command: string, args: Record<string, unknown> = {}): Promise<T> {
  if (!isTauri()) throw new Error(t("La connexion Aède nécessite l’application desktop."));
  try {
    return await invoke<T>(command, { version: 1, ...args });
  } catch (error) {
    throw new Error(typeof error === "string" ? t(error) : t("Opération native impossible."));
  }
}
export const loginAede = (server: string, username: string, password: string) =>
  nativeCall<import("../library/server").AccountSession>("aede_login", {
    server,
    username,
    password,
  });
export const downloadAede = (id: string, source: SourceId = requestSource) =>
  nativeCall<string>("aede_download", { id, source });
/** Fetch the server-selected complete report and save it under the native Downloads folder. */
export const downloadAnalysisAede = (reference: string) =>
  nativeCall<string>("aede_download_analysis", { reference });
export const logoutAede = () => nativeCall<void>("aede_logout");
export const syncAede = (source: SourceId = requestSource) =>
  nativeCall<unknown>("aede_sync", { source });
export const cachedAede = (source: SourceId = "server") =>
  nativeCall<unknown | null>("aede_cache", { source });
export const artworkAede = (reference: string, kind: string) =>
  nativeCall<ArrayBuffer>("aede_artwork", { reference, kind });
export function requestAede<T>(
  path: string,
  query: Record<string, string> = {},
  method = "GET",
  body: unknown = null,
  source: SourceId = requestSource,
): Promise<T> {
  const entity =
    query.ref ??
    query.reference ??
    query.track ??
    (body && typeof body === "object"
      ? ((body as Record<string, unknown>).release ?? (body as Record<string, unknown>).track)
      : undefined);
  const origin = typeof entity === "string" ? referenceSource(entity) : source;
  return nativeCall<T>("aede_request", { path, query, method, body, source: origin });
}

/** PCM credentials and device callbacks stay native; only bounded transport controls cross IPC. */
export const playbackState = () => nativeCall<unknown>("playback_state");
export const playbackOutputs = () => nativeCall<unknown>("playback_devices");
export const playbackStart = (
  tracks: readonly string[],
  device: string,
  index: number,
  policy = "without-effects",
) => nativeCall<void>("playback_start", { tracks, device, index, policy });
export const playbackControl = (action: string, value: unknown = null) =>
  nativeCall<unknown>("playback_control", { action, value });

/** Save the authenticated server-selected spectrum without exposing filesystem writes. */
export const downloadSpectrumAede = (reference: string) =>
  nativeCall<string>("aede_download_spectrum", { reference });

/** Explicit external radio requests never reuse Aède authority or credentials. */
export const searchRadio = (
  name: string,
  country: string,
  tag: string,
  offset: number,
  secureOnly: boolean,
) => nativeCall<unknown>("radio_search", { name, country, tag, offset, secureOnly });
export const radioStatistics = () => nativeCall<unknown>("radio_statistics");
export const resolveRadio = (uuid: string) => nativeCall<unknown>("radio_resolve", { uuid });

let requestSource: SourceId = "server";
/** Only ownerless requests use the explicitly selected personal-library scope. */
export function setRequestSource(source: SourceId) {
  requestSource = source;
}
export interface LocalStatus {
  enabled: boolean;
  running: boolean;
  roots: { path: string; available: boolean; mount: string | null }[];
  keys: { fanart: boolean; acoustid: boolean };
}
export const localStatus = () => nativeCall<LocalStatus>("local_status");
export const startLocal = () =>
  nativeCall<import("../library/server").AccountSession>("local_start");
export const stopLocal = () => nativeCall<void>("local_stop");
export const pickLocalRoots = () => nativeCall<void>("local_pick_roots");
export const scanLocal = (full: boolean, threads: number) =>
  nativeCall<{ task_id: number; status: "queued" }>("local_scan", { full, threads });
export const localRootAction = (path: string, action: "remove" | "exclude" | "include") =>
  nativeCall<void>("local_root_action", { path, action });
export const saveLocalKeys = (
  fanart: string,
  acoustid: string,
  removeFanart: boolean,
  removeAcoustid: boolean,
) => nativeCall<void>("local_keys", { fanart, acoustid, removeFanart, removeAcoustid });

/** Automatic missing covers follow the user's chosen policy; credentials stay on their Aède source. */
export const missingCoverAede = (artist: string, group: string, download: boolean) =>
  nativeCall<ArrayBuffer>("aede_missing_cover", { artist, group, download });

/** Read mounted player/card/drive destinations; this command cannot mount or write them. */
export const discoverPlayers = () => nativeCall<unknown>("players_discover");

/** Explicit, bounded public RSS retrieval has no access to Aède credentials. */
export const readPodcastFeed = (url: string) => nativeCall<string>("podcast_feed", { url });

/** Native dialogs restrict theme exchange to a bounded user-selected JSON document. */
export const importTheme = () => nativeCall<string | null>("theme_import");
export const exportTheme = (document: string) =>
  nativeCall<string | null>("theme_export", { document });

/** Save the complete CSV only to a native user-selected destination. */
export const exportStatistics = (document: string) =>
  nativeCall<string | null>("statistics_export", { document });

/** Explicit LAN HQPlayer probe, independent of Aède authentication and local audio processing. */
export const connectHqPlayer = (
  host: string,
  port: number,
  mappings: readonly { from: string; to: string }[],
) =>
  nativeCall<{ connected: boolean; product: string; version: string; name: string }>(
    "hqplayer_connect",
    { host, port, mappings },
  );
export const disconnectHqPlayer = () => nativeCall<void>("hqplayer_disconnect");

/** Explicit episode download streams to Downloads/Phémios/Podcasts, without overwriting prior files. */
export const downloadPodcastEpisode = (url: string, title: string) =>
  nativeCall<string>("podcast_download", { url, title });

/** Explicit public Wikipedia search, independent of library/account authority. */
export const searchEncyclopedia = (language: import("../i18n").Language, query: string) =>
  nativeCall<unknown>("encyclopedia_search", { language, query });
/** Read one public main-namespace page as bounded plain text, never executable HTML. */
export const readEncyclopedia = (language: import("../i18n").Language, pageId: number) =>
  nativeCall<unknown>("encyclopedia_article", { language, pageId });

/** Explicit source-link activation uses a bounded HTTPS-only native browser handoff. */
export const openExternalLink = (url: string) => nativeCall<void>("external_open", { url });

/** Follow a verified interlanguage link rather than searching by the displayed article title. */
export const translateEncyclopedia = (
  language: import("../i18n").Language,
  pageId: number,
  target: import("../i18n").Language,
) => nativeCall<unknown>("encyclopedia_translate", { language, pageId, target });

/** Export the already-read edition under native Downloads; no arbitrary destination or network request. */
export const downloadEncyclopedia = (
  article: import("../encyclopedia/wikipedia").WikipediaArticle,
) =>
  nativeCall<string>("encyclopedia_export", {
    language: article.language,
    pageId: article.pageId,
    document: wikipediaDocument(article),
  });

/** Device-private provider configuration returns only its presence, never the retained key. */
export const configureConcerts = (key: string | null = null, remove = false) =>
  nativeCall<boolean>("concerts_config", { key, remove });
/** Explicit fixed-provider page lookup independent of library login. */
export const searchConcerts = (artist: string, page: number) =>
  nativeCall<unknown>("concerts_events", { artist, page });

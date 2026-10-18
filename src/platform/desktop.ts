import { concertConfig } from "../concerts/config";
import { engineVersions } from "../library/product-versions";
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
  embedded?: { aede: string; flaccompagnon: string };
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
  return info.embedded !== undefined ? { ...info, embedded: engineVersions(info.embedded)! } : info;
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
const nativeSessions: Partial<Record<SourceId, string>> = {};
/** An opaque non-secret process ticket binds queued IPC to its original session, not a caller-supplied owner. */
function rememberNativeSession(
  source: SourceId,
  account: import("../library/server").AccountSession,
) {
  if (typeof account.nativeSession === "string") nativeSessions[source] = account.nativeSession;
  else delete nativeSessions[source];
}
/** An imported public certificate applies only to this explicit local login. */
export interface LocalServerProfile {
  format: "aede-local-server";
  version: 1;
  address: string;
  username: string;
  certificate: number[];
}
export const importLocalServerProfile = () =>
  nativeCall<LocalServerProfile | null>("aede_import_profile");
export async function loginAede(
  server: string,
  username: string,
  password: string,
  certificate?: number[],
) {
  const account = await nativeCall<import("../library/server").AccountSession>("aede_login", {
    server,
    username,
    password,
    ...(certificate ? { certificate } : {}),
  });
  rememberNativeSession("server", account);
  return account;
}
export const downloadAede = (id: string, source: SourceId = requestSource) =>
  nativeCall<string>("aede_download", { id, source, expectedSession: nativeSessions[source] });
/** Fetch the server-selected complete report and save it under the native Downloads folder. */
export const downloadAnalysisAede = (reference: string) =>
  nativeCall<string>("aede_download_analysis", { reference });
export function logoutAede() {
  delete nativeSessions.server;
  return nativeCall<void>("aede_logout");
}
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
  expectedAccount?: import("../library/server").AccountSession,
): Promise<T> {
  const entity =
    query.ref ??
    query.reference ??
    query.track ??
    (body && typeof body === "object"
      ? ((body as Record<string, unknown>).release ??
        (body as Record<string, unknown>).reference ??
        (body as Record<string, unknown>).track)
      : undefined);
  const origin = typeof entity === "string" ? referenceSource(entity) : source;
  const expectedSession = expectedAccount ? expectedAccount.nativeSession : nativeSessions[origin];
  return nativeCall<T>("aede_request", {
    path,
    query,
    method,
    body,
    source: origin,
    ...(expectedSession ? { expectedSession } : {}),
  });
}

/** Optical access uses only opaque, previously discovered native selectors. */
export const scanCd = (id?: string) => nativeCall<unknown>("cd_scan", { id });
/** Only the native file dialog can choose a CUE path and admit its bounded relative BIN files. */
export const openCdImage = () => nativeCall<string | null>("cd_open_image");
export const ejectCd = (id: string) => nativeCall<unknown>("cd_eject", { id });
export const startCd = (token: string, tracks: readonly string[], device: string, index: number) =>
  nativeCall<void>("cd_start", { token, tracks, device, index });

/** PCM credentials and device callbacks stay native; only bounded transport controls cross IPC. */
export const playbackState = () => nativeCall<unknown>("playback_state");
export const playbackOutputs = () => nativeCall<unknown>("playback_devices");
export const playbackStart = (
  tracks: readonly string[],
  device: string,
  index: number,
  policy = "without-effects",
) =>
  nativeCall<void>("playback_start", {
    tracks,
    device,
    index,
    policy,
    expectedSession: nativeSessions[tracks[0] ? referenceSource(tracks[0]) : requestSource],
  });
/** Append exact occurrences to the captured native queue, never restarting the current output. */
export const playbackAppend = (queueId: number, expectedTotal: number, tracks: readonly string[]) =>
  nativeCall<void>("playback_append", {
    tracks,
    queueId,
    expectedTotal,
    expectedSession: nativeSessions[tracks[0] ? referenceSource(tracks[0]) : requestSource],
  });
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
export async function startLocal() {
  const account = await nativeCall<import("../library/server").AccountSession>("local_start");
  rememberNativeSession("local", account);
  return account;
}
export function stopLocal() {
  delete nativeSessions.local;
  return nativeCall<void>("local_stop");
}
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
/** Grant a destination through the native dialog only; cancellation leaves the current selection intact. */
export const pickTransferFolder = () => nativeCall<unknown | null>("transfer_pick_folder");
/** Forget a manual destination token without deleting its directory or files. */
export const forgetTransferFolder = (id: string) =>
  nativeCall<void>("transfer_forget_folder", { id });
/** Eject only an opaque native-discovered destination; never accepts an OS path. */
export const ejectPlayer = (id: string) => nativeCall<void>("players_eject", { id });

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
  nativeCall<string>("podcast_download", {
    url,
    title,
    source: requestSource,
    expectedSession: nativeSessions[requestSource],
  });

/** Explicit public Wikipedia search, independent of library/account authority. */
export const searchEncyclopedia = (language: import("../i18n").Language, query: string) =>
  nativeCall<unknown>("encyclopedia_search", { language, query });
/** Read one public main-namespace page as bounded plain text, never executable HTML. */
export const readEncyclopedia = (language: import("../i18n").Language, pageId: number) =>
  nativeCall<unknown>("encyclopedia_article", { language, pageId });

/** Read only a public retained biography; never dispatch a network request. */
export const readCachedBiography = (language: import("../i18n").Language, title: string) =>
  nativeCall<unknown | null>("biography_cached", { language, title });
/** Read the exact attributed title, resolving canonical redirects without a name search. */
export const readEncyclopediaTitle = (language: import("../i18n").Language, title: string) =>
  nativeCall<unknown>("encyclopedia_title", { language, title });

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
  nativeCall<unknown>("concerts_config", { key, remove }).then(concertConfig);
/** Explicit fixed-provider page lookup independent of library login. */
export const searchConcerts = (artist: string, page: number) =>
  nativeCall<unknown>("concerts_events", { artist, page });

/** Explicit native dialogs exchange bounded preferences and reviewed per-account personal backups. */
export const importPreferences = () => nativeCall<string | null>("preferences_import");
export const exportPreferences = (
  document: string,
  source?: SourceId,
  account?: import("../library/server").AccountSession,
) =>
  nativeCall<string | null>("preferences_export", {
    document,
    source,
    session: account?.nativeSession,
  });

/** Native identity selects the private podcast document; IPC supplies no account identifier or path. */
export function readPodcastState(
  source: SourceId,
  account: import("../library/server").AccountSession,
) {
  if (!account.nativeSession) return Promise.reject(new Error(t("Session invalide.")));
  return nativeCall<unknown>("podcast_state", { source, session: account.nativeSession });
}
/** Apply only a captured-session private podcast mutation. */
export function updatePodcastState(
  action: "save" | "remove" | "mark",
  payload: unknown,
  source: SourceId,
  account: import("../library/server").AccountSession,
) {
  if (!account.nativeSession) return Promise.reject(new Error(t("Session invalide.")));
  return nativeCall<unknown>("podcast_update", {
    action,
    payload,
    source,
    session: account.nativeSession,
  });
}

/** Read retained articles using only the captured process ticket and actual native source. */
export function readArticleState(
  source: SourceId,
  account: import("../library/server").AccountSession,
) {
  if (!account.nativeSession) return Promise.reject(new Error(t("Session invalide.")));
  return nativeCall<unknown>("article_state", { source, session: account.nativeSession });
}
/** Save/remove one article under exact native generation; no owner or pathname crosses IPC. */
export function updateArticleState(
  action: "save" | "remove",
  payload: unknown,
  source: SourceId,
  account: import("../library/server").AccountSession,
) {
  if (!account.nativeSession) return Promise.reject(new Error(t("Session invalide.")));
  return nativeCall<unknown>("article_update", {
    action,
    payload,
    source,
    session: account.nativeSession,
  });
}

/** Personal backup admission always captures the connected native account generation. */
export function readPersonalBackup(
  source: SourceId,
  account: import("../library/server").AccountSession,
) {
  if (!account.nativeSession)
    throw new Error(t("Session remplacée ou déconnectée. Reconnectez-vous."));
  return nativeCall<unknown>("personal_backup_read", { source, session: account.nativeSession });
}
/** Explicitly reviewed restoration adds data only to the captured destination account. */
export function restorePersonalBackup(
  payload: unknown,
  source: SourceId,
  account: import("../library/server").AccountSession,
) {
  if (!account.nativeSession)
    throw new Error(t("Session remplacée ou déconnectée. Reconnectez-vous."));
  return nativeCall<void>("personal_backup_restore", {
    source,
    session: account.nativeSession,
    payload,
  });
}
/** Export the server-confirmed note for this exact source/session, never an unsaved draft. */
export function downloadNoteAede(reference: string) {
  const source = referenceSource(reference);
  return nativeCall<string>("note_export", { reference, expectedSession: nativeSessions[source] });
}

/** Destination selectors and preview tickets are issued natively; source files never enter JavaScript. */
export const prepareTransfer = (
  destination: string,
  references: readonly string[],
  options: import("../library/transfers").TransferOptions,
) =>
  nativeCall<import("../library/transfers").TransferPreview>("transfer_prepare", {
    destination,
    references,
    options,
    expectedSessions: { ...nativeSessions },
  });
/** Only a reviewed preview can start one retained native transfer. */
export const startTransfer = (id: string) => nativeCall<unknown>("transfer_start", { id });
export const transferStatus = () =>
  nativeCall<import("../library/transfers").TransferStatus>("transfer_status");
export const cancelTransfer = () => nativeCall<void>("transfer_cancel");

/** Begin a new native display lease scope; a replaced controller cannot retain an older scope. */
export const openAwakeScope = () => nativeCall<string>("awake_open");
/** Renew or release this exact scope; native expiry bounds lost UI/controller updates. */
export const updateAwakeScope = (scope: string, active: boolean) =>
  nativeCall<void>("awake_update", { scope, active });

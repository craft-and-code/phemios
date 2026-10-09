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
    (body && typeof body === "object" ? (body as Record<string, unknown>).release : undefined);
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

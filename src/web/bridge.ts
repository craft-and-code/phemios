import { demoAccount, demoMedia, demoSnapshot } from "./catalog";
import { demoRequest } from "./demo-api";
import { WebPlayer } from "./player";
import { WebSession } from "./session";
import { assertPersonalWeb, webMode } from "./runtime";
const modeKey = "phemios.web.mode.v1";
export async function changeWebMode(mode: "demo" | "personal", reset = false) {
  if (mode === "personal") assertPersonalWeb();
  player.stop();
  await session.logout();
  if (reset)
    localStorage.removeItem(
      "phemios.interface-profile.v1:" +
        encodeURIComponent(JSON.stringify(["server", `${location.origin}/web-demo`, "web-demo"])),
    );
  localStorage.setItem(modeKey, mode);
  location.reload();
}
const player = new WebPlayer(async (reference, signal) =>
  webMode() === "demo" ? { url: demoMedia(reference) } : session.media(reference, signal),
);
const session = new WebSession(location.origin, () => player.stop());
const demoOwner = {
  nativeSession: "1",
  server: `${location.origin}/web-demo`,
  account: demoAccount,
};
const absentLocal = {
  enabled: false,
  running: false,
  roots: [],
  keys: { fanart: false, acoustid: false },
};
/** Narrow browser implementation of the existing typed bridge. Unsupported native operations stay explicit. */
export async function webCall<T>(command: string, args: Record<string, unknown>): Promise<T> {
  const demo = webMode() === "demo",
    owner = demo ? demoOwner : session.current();
  if (args.expectedSession !== undefined && args.expectedSession !== owner?.nativeSession)
    throw new Error("Session remplacée ou déconnectée.");
  let result: unknown;
  if (command === "aede_session") result = args.source === "local" ? null : (owner ?? null);
  else if (command === "aede_cache") result = null;
  else if (command === "local_status") result = absentLocal;
  else if (command === "aede_sync")
    result = demo ? demoSnapshot(demoOwner.server) : await session.snapshot();
  else if (command === "aede_login") {
    assertPersonalWeb();
    result = await session.login(String(args.server), String(args.username), String(args.password));
  } else if (command === "aede_logout") {
    player.stop();
    await session.logout();
  } else if (command === "aede_request") {
    const path = String(args.path),
      query = (args.query ?? {}) as Record<string, string>,
      method = String(args.method ?? "GET");
    result = demo
      ? demoRequest(path, query, method, args.body, demoOwner.server)
      : await session.request(path, query, method, args.body ?? null);
  } else if (command === "aede_artwork")
    result = await session.request(
      "/api/v1/artwork",
      { ref: String(args.reference), kind: String(args.kind), size: "512" },
      "GET",
      null,
      true,
    );
  else if (command === "playback_devices")
    result = [
      { id: "@browser", name: "Sortie audio du navigateur · DSP Aède WebAssembly", default: true },
    ];
  else if (command === "playback_state") result = player.snapshot();
  else if (command === "playback_start")
    result = await player.start(
      args.tracks as string[],
      Number(args.index),
      String(args.device ?? ""),
      String(args.policy),
    );
  else if (command === "playback_append")
    result = player.append(
      Number(args.queueId),
      Number(args.expectedTotal),
      args.tracks as string[],
    );
  else if (command === "playback_control")
    result = await player.control(String(args.action), args.value);
  else throw new Error("Cette fonction nécessite l’application desktop de Phémios.");
  return result as T;
}
window.addEventListener("pagehide", () => {
  player.stop();
  void session.logout();
});

// pagehide retires named credentials immediately. A BFCache restoration reuses the old
// frontend realm, so reload before showing its retained owner/transport as connected.
window.addEventListener("pageshow", (event) => {
  if (event.persisted) location.reload();
});

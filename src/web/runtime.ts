import { isTauri } from "@tauri-apps/api/core";
/** Explicit Web build only; desktop and ordinary browser previews retain their existing bridge. */
export const webEnabled = () => import.meta.env.VITE_PHEMIOS_WEB === "true" && !isTauri();
/** Public static hosting never accepts personal credentials or an inherited personal-mode setting. */
export const publicWebDemo = () => import.meta.env.VITE_PHEMIOS_PUBLIC_DEMO === "true";
export function assertPersonalWeb() {
  if (publicWebDemo())
    throw new Error(
      "La démonstration publique n’ouvre pas de session Aède. Hébergez Phémios Web avec votre serveur pour utiliser votre bibliothèque.",
    );
}
export function webMode(): "demo" | "personal" {
  if (publicWebDemo()) return "demo";
  return localStorage.getItem("phemios.web.mode.v1") === "personal" ? "personal" : "demo";
}
export const webUnavailable = new Set([
  "moods",
  "collections",
  "history",
  "radio",
  "podcasts",
  "cd",
  "concerts",
  "doctor",
  "players",
  "achievements",
  "statistics",
  "relations",
  "encyclopedia",
  "analysis",
]);

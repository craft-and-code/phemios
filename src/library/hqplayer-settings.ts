import { t } from "../i18n";
export interface HqPlayerSettings {
  host: string;
  port: number;
  from: string;
  to: string;
}
export const hqPlayerKey = "phemios.hqplayer.v1";
export const defaultHqPlayer: HqPlayerSettings = {
  host: "localhost",
  port: 4321,
  from: "",
  to: "",
};
/** Device-bound non-secret settings are retained locally, never replayed as a connection. */
export function readHqPlayer(raw: string | null): HqPlayerSettings {
  if (raw === null) return { ...defaultHqPlayer };
  const v: unknown = JSON.parse(raw);
  if (!v || typeof v !== "object" || Array.isArray(v))
    throw new Error(t("Configuration HQPlayer invalide."));
  const value = v as Record<string, unknown>;
  if (
    Object.keys(value).some((key) => !["host", "port", "from", "to"].includes(key)) ||
    typeof value.host !== "string" ||
    !value.host ||
    value.host.length > 253 ||
    /[\s/@?#]/.test(value.host) ||
    !Number.isInteger(value.port) ||
    Number(value.port) < 1 ||
    Number(value.port) > 65535 ||
    ![value.from, value.to].every(
      (path) =>
        typeof path === "string" &&
        path.length <= 4096 &&
        ![...path].some((char) => char.charCodeAt(0) < 32),
    ) ||
    Boolean(value.from) !== Boolean(value.to) ||
    [value.from, value.to].some(
      (path) =>
        typeof path === "string" &&
        path !== "" &&
        (!path.startsWith("/") ||
          path === "/" ||
          path.split("/").some((part) => part === ".." || part === ".")),
    )
  )
    throw new Error(t("Configuration HQPlayer invalide."));
  return value as unknown as HqPlayerSettings;
}

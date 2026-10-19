import { t } from "../i18n";
export type Protocol = "openhome" | "googlecast" | "slimproto" | "upnp";
export interface Device {
  name: string;
  endpoint: string;
  protocol: Protocol;
}
export const protocolNames: Record<Protocol, string> = {
  openhome: "OpenHome",
  googlecast: "Cast",
  slimproto: "SlimProto",
  upnp: "UPnP",
};
const order: Protocol[] = ["openhome", "googlecast", "slimproto", "upnp"];
export const deviceKey = (device: Device) => `${device.protocol}:${device.endpoint}`;
/** Versioned discovery stays bounded; a legacy response represents UPnP only. */
export function parseDevices(raw: unknown): Device[] {
  const items = (raw as { items?: unknown } | null)?.items;
  if (!Array.isArray(items) || items.length > 96)
    throw new Error(t("Réponse audio réseau invalide."));
  const devices: Device[] = items.map((value) => {
    const row = value as Device;
    const protocol = row?.protocol ?? "upnp";
    if (
      !row ||
      typeof row.name !== "string" ||
      !row.name ||
      row.name.length > 4096 ||
      typeof row.endpoint !== "string" ||
      !row.endpoint ||
      row.endpoint.length > 4096 ||
      !order.includes(protocol)
    )
      throw new Error(t("Réponse audio réseau invalide."));
    return { name: row.name, endpoint: row.endpoint, protocol };
  });
  if (new Set(devices.map(deviceKey)).size !== devices.length)
    throw new Error(t("Réponse audio réseau invalide."));
  return devices.sort(
    (a, b) => order.indexOf(a.protocol) - order.indexOf(b.protocol) || a.name.localeCompare(b.name),
  );
}
/** Manual SlimProto targets remain literal LAN IPv4 peers; the server repeats admission. */
export function slimprotoDevice(ip: string): Device {
  const parts = ip.split(".");
  const [a, b] = parts.map(Number);
  if (
    parts.length !== 4 ||
    parts.some((p) => !/^(0|[1-9][0-9]{0,2})$/.test(p) || Number(p) > 255) ||
    !(
      a === 10 ||
      a === 127 ||
      (a === 192 && b === 168) ||
      (a === 172 && b! >= 16 && b! <= 31) ||
      (a === 169 && b === 254)
    )
  )
    throw new Error(t("Indiquez une adresse IPv4 privée pour le lecteur SlimProto."));
  return { name: `SlimProto · ${ip}`, endpoint: ip, protocol: "slimproto" };
}

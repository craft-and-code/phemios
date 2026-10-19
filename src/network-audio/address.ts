import type { SourceId } from "../library/sources";
/** Only a literal private LAN host can prefill the server-side bind; never resolve DNS or use loopback. */
export function networkAudioAddress(source: SourceId, server: string | undefined): string {
  if (source !== "server" || !server) return "";
  try {
    const url = new URL(server);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) return "";
    const ip = url.hostname,
      parts = ip.split(".");
    if (
      parts.length !== 4 ||
      parts.some((part) => !/^(0|[1-9][0-9]{0,2})$/.test(part) || Number(part) > 255)
    )
      return "";
    const [a, b] = parts.map(Number);
    return a === 10 ||
      (a === 172 && b! >= 16 && b! <= 31) ||
      (a === 192 && b === 168) ||
      (a === 169 && b === 254)
      ? ip
      : "";
  } catch {
    return "";
  }
}

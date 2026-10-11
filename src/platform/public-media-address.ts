/** Admission for explicit browser media: canonical HTTP(S), no credentials and no non-public literals.
 * This cannot validate DNS resolution or later redirects in a WebView. Native feed/download
 * clients separately guard the actual resolved socket; browser playback keeps that platform limit.
 * Public IPv6 media remains unsupported, matching the previous browser policy.
 */
export function publicMediaAddress(
  value: unknown,
  maxLength: number,
  base?: string,
): URL | undefined {
  if (typeof value !== "string" || value.length > maxLength || /\p{Cc}/u.test(value))
    return undefined;
  try {
    const url = new URL(value, base),
      host = url.hostname.toLowerCase().replace(/\.$/, "");
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.hash ||
      url.href.length > maxLength ||
      !host.includes(".") ||
      host.endsWith(".local") ||
      host.endsWith(".localhost") ||
      host.startsWith("[")
    )
      return undefined;
    if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) {
      const [a = 0, b = 0, c = 0, d = 0] = host.split(".").map(Number);
      if (
        a === 0 ||
        a === 10 ||
        a === 127 ||
        a >= 224 ||
        (a === 100 && b >= 64 && b <= 127) ||
        (a === 169 && b === 254) ||
        (a === 172 && b >= 16 && b <= 31) ||
        (a === 192 && b === 168) ||
        // IANA protocol space has only the .9/.10 globally reachable exceptions.
        (a === 192 && b === 0 && c === 0 && d !== 9 && d !== 10) ||
        (a === 192 && b === 88 && c === 99) ||
        (a === 192 && b === 0 && c === 2) ||
        (a === 198 && b === 51 && c === 100) ||
        (a === 198 && b >= 18 && b <= 19) ||
        (a === 203 && b === 0 && c === 113)
      )
        return undefined;
    }
    return url;
  } catch {
    return undefined;
  }
}

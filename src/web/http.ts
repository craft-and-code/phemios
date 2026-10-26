/** Credentials remain in memory and HTTP headers; responses and media have explicit byte/deadline bounds. */
export async function boundedBody(
  response: Response,
  limit: number,
): Promise<Uint8Array<ArrayBuffer>> {
  const declared = response.headers.get("content-length");
  if (declared && (!/^\d+$/.test(declared) || Number(declared) > limit)) {
    await response.body?.cancel();
    throw new Error("Réponse Web trop volumineuse.");
  }
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Réponse Web vide.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const row = await reader.read();
      if (row.done) break;
      size += row.value.length;
      if (size > limit) throw new Error("Réponse Web trop volumineuse.");
      chunks.push(row.value);
    }
  } catch (error) {
    await reader.cancel();
    throw error;
  }
  const result = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}
export function sameOriginServer(value: string, origin: string): string {
  const url = new URL(value),
    base = new URL(origin);
  if (
    url.origin !== base.origin ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash ||
    (url.protocol !== "https:" && !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))
  )
    throw new Error(
      "Ouvrez Phémios Web depuis l’adresse HTTPS de votre serveur Aède. L’interface et l’API doivent partager la même origine.",
    );
  return url.origin;
}
export function apiUrl(server: string, path: string, query: Record<string, string>): string {
  if (
    !/^\/api\/(?:v1|auth\/v1|me\/v1|admin\/v1)\//.test(path) ||
    /[\\?#]/.test(path) ||
    path.includes("..")
  )
    throw new Error("Route Web non autorisée.");
  const url = new URL(path, server);
  for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value);
  return url.href;
}

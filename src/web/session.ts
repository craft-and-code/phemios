import { apiUrl, boundedBody, sameOriginServer } from "./http";
import type { AccountSession } from "../library/server";
/** A single named browser login; replacing it retires every captured request before publishing another owner. */
export class WebSession {
  private generation = 0;
  private token = "";
  private account: AccountSession | undefined;
  private pending = new Set<AbortController>();
  constructor(
    private readonly origin: string,
    private readonly retired: () => void,
  ) {}
  current() {
    return this.account;
  }
  async logout() {
    const account = this.account,
      token = this.token;
    this.generation++;
    this.account = undefined;
    this.token = "";
    this.retired();
    for (const controller of this.pending) controller.abort();
    this.pending.clear();
    if (account && token) {
      try {
        await fetch(apiUrl(account.server, "/api/auth/v1/session", {}), {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
          credentials: "omit",
          redirect: "error",
          cache: "no-store",
          signal: AbortSignal.timeout(2000),
        });
      } catch {
        /* Local logout is immediate even if the old authority is unavailable. */
      }
    }
  }
  async login(server: string, username: string, password: string) {
    server = sameOriginServer(server, this.origin);
    const retiring = this.logout();
    const generation = this.generation;
    await retiring;
    if (generation !== this.generation) throw new Error("Connexion annulée.");
    const controller = new AbortController();
    this.pending.add(controller);
    let raw;
    try {
      const response = await fetch(apiUrl(server, "/api/auth/v1/session", {}), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
        credentials: "omit",
        redirect: "error",
        cache: "no-store",
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]),
      });
      if (!response.ok) throw new Error("Connexion Aède refusée ou serveur indisponible.");
      raw = JSON.parse(new TextDecoder().decode(await boundedBody(response, 65536)));
    } finally {
      this.pending.delete(controller);
    }
    if (generation !== this.generation) {
      // A response may arrive despite abort; retire its token without touching a successor login.
      if (/^[0-9a-f]{64}$/i.test(raw?.token)) {
        try {
          await fetch(apiUrl(server, "/api/auth/v1/session", {}), {
            method: "DELETE",
            headers: { Authorization: `Bearer ${raw.token}` },
            credentials: "omit",
            redirect: "error",
            cache: "no-store",
            signal: AbortSignal.timeout(2000),
          });
        } catch {
          /* The abandoned token is never retained locally. */
        }
      }
      throw new Error("Connexion annulée.");
    }
    if (
      !raw ||
      !/^[0-9a-f]{64}$/i.test(raw.token) ||
      typeof raw.account?.id !== "string" ||
      typeof raw.account?.username !== "string" ||
      !["admin", "user", "auditor"].includes(raw.account?.role)
    )
      throw new Error("Session Aède invalide.");
    this.token = raw.token;
    this.account = { server, nativeSession: String(generation), account: raw.account };
    if (raw.account.parental_enabled === true) {
      await this.logout();
      throw new Error("Ce compte supervisé nécessite l’application desktop pour la lecture.");
    }
    return this.account;
  }
  async request(
    path: string,
    query: Record<string, string> = {},
    method = "GET",
    body: unknown = null,
    media = false,
    signal?: AbortSignal,
  ): Promise<unknown> {
    const account = this.account,
      token = this.token,
      generation = this.generation;
    if (!account || !token) throw new Error("Connectez-vous à Aède.");
    const controller = new AbortController();
    this.pending.add(controller);
    const combined = AbortSignal.any([
      controller.signal,
      AbortSignal.timeout(media ? 60000 : 15000),
      ...(signal ? [signal] : []),
    ]);
    try {
      const response = await fetch(apiUrl(account.server, path, query), {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          ...(body === null ? {} : { "Content-Type": "application/json" }),
        },
        ...(body === null ? {} : { body: JSON.stringify(body) }),
        credentials: "omit",
        redirect: "error",
        cache: "no-store",
        signal: combined,
      });
      combined.throwIfAborted();
      if (!response.ok) throw new Error(`Aède : requête refusée (${response.status}).`);
      const bytes = await boundedBody(response, media ? 64 * 1024 * 1024 : 16 * 1024 * 1024);
      combined.throwIfAborted();
      if (generation !== this.generation || account !== this.account)
        throw new Error("Session remplacée ou déconnectée.");
      if (media) return bytes.buffer;
      const value = bytes.length ? JSON.parse(new TextDecoder().decode(bytes)) : null;
      if (
        (path === "/api/me/v1/parental" && value?.policy?.enabled === true) ||
        (path === "/api/auth/v1/session" && value?.parental_enabled === true)
      ) {
        this.retired();
        throw new Error("Ce compte supervisé nécessite l’application desktop pour la lecture.");
      }
      return value;
    } finally {
      this.pending.delete(controller);
    }
  }
  async snapshot() {
    const owner = this.account;
    if (!owner) throw new Error("Connectez-vous à Aède.");
    let stamp: number | undefined,
      bytes = 0;
    const pages = async (path: string) => {
      const rows: unknown[] = [];
      let total: number | undefined;
      do {
        const page = (await this.request(path, { offset: String(rows.length), limit: "200" })) as {
          total: number;
          scanned_at: number;
          offset: number;
          items: unknown[];
        };
        bytes += JSON.stringify(page).length;
        if (
          owner !== this.account ||
          bytes > 16 * 1024 * 1024 ||
          !Number.isSafeInteger(page.total) ||
          page.total < 0 ||
          page.total > 100000 ||
          !Number.isSafeInteger(page.scanned_at) ||
          (stamp !== undefined && stamp !== page.scanned_at) ||
          (total !== undefined && total !== page.total) ||
          page.offset !== rows.length ||
          !Array.isArray(page.items) ||
          page.items.length !== Math.min(200, page.total - rows.length)
        )
          throw new Error(
            "Le catalogue a changé ou dépasse la limite Web. Relancez la synchronisation.",
          );
        stamp = page.scanned_at;
        total = page.total;
        rows.push(...page.items);
      } while (rows.length < total);
      return rows;
    };
    const artists = await pages("/api/v1/presentation/artists"),
      albums = await pages("/api/v1/presentation/albums"),
      tracks = await pages("/api/v1/presentation/tracks");
    return {
      server: owner.server,
      accountId: owner.account.id,
      scannedAt: stamp,
      artists,
      albums,
      tracks,
    };
  }
  async media(reference: string, signal: AbortSignal) {
    const owner = this.account;
    signal.throwIfAborted();
    const plan = (await this.request(
      "/api/me/v1/exports/plan",
      {},
      "POST",
      {
        references: [reference],
        format: "original",
      },
      false,
      signal,
    )) as { items: { reference: string; stamp: string; bytes: number }[] };
    signal.throwIfAborted();
    if (!owner || owner !== this.account) throw new Error("Session remplacée ou déconnectée.");
    const row = plan.items?.find((row) => row.reference === reference);
    if (
      !row ||
      typeof row.stamp !== "string" ||
      !Number.isSafeInteger(row.bytes) ||
      row.bytes < 0 ||
      row.bytes > 64 * 1024 * 1024
    )
      throw new Error("Ce fichier dépasse la limite de lecture Web (64 Mio).");
    const bytes = (await this.request(
      "/api/me/v1/exports/original",
      { ref: reference, stamp: row.stamp },
      "GET",
      null,
      true,
      signal,
    )) as ArrayBuffer;
    signal.throwIfAborted();
    if (owner !== this.account) throw new Error("Session remplacée ou déconnectée.");
    const url = URL.createObjectURL(new Blob([bytes]));
    return { url, release: () => URL.revokeObjectURL(url) };
  }
}

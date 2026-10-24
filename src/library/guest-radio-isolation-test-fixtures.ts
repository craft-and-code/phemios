import { vi } from "vitest";
import type { Mock } from "vitest";
import { mountLibrary } from "./context-test-fixtures";
import { parentalStatus, settleParental } from "./parental-test-fixtures";
import { idlePlayback } from "./playback-state";
import type { AccountSession } from "./server";
import type { SourceId } from "./sources";
import {
  loginAede,
  startLocal,
  syncAede,
  requestAede,
  resolveRadio,
  playbackControl,
  playbackStart,
  playbackState,
} from "../platform/desktop";
import { browserRadioMedia } from "../radio/playback";
import type { RadioMedia } from "../radio/playback";

export const guestStation = {
  uuid: "12345678-1234-1234-1234-123456789021",
  name: "Guest Fixture Radio",
  country: "France",
  tags: "rock",
  codec: "MP3",
  bitrate: 128,
};
export interface IsolationRadioMedia {
  source: Mock<RadioMedia["source"]>;
  volume: Mock<RadioMedia["volume"]>;
  play: Mock<RadioMedia["play"]>;
  release: Mock<RadioMedia["release"]>;
  callbacks: Mock<RadioMedia["callbacks"]>;
}
export interface RadioIsolationFixture {
  library: ReturnType<typeof mountLibrary>;
  owners: Record<SourceId, AccountSession>;
  media: IsolationRadioMedia[];
  signIn: (source: SourceId) => Promise<void>;
  refuse: (source: SourceId) => void;
}
export interface IsolationDeferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
}
export function isolationDeferred<T>(): IsolationDeferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((finish) => {
    resolve = finish;
  });
  return { promise, resolve };
}
function isolationMedia(): IsolationRadioMedia {
  let playing = () => {};
  return {
    source: vi.fn(),
    volume: vi.fn(),
    play: vi.fn(async () => {
      playing();
    }),
    release: vi.fn(),
    callbacks: vi.fn((next: () => void, _waiting: () => void, _failure: () => void) => {
      playing = next;
    }),
  };
}
/** Mount the actual provider; only IPC and the radio's browser-media port are substituted. */
export function radioIsolation(
  roles: Partial<Record<SourceId, "admin" | "supervised">> = {},
): RadioIsolationFixture {
  const owner = (source: SourceId): AccountSession => ({
    nativeSession: `${source}-isolation-session`,
    server: `https://${source}.fixture.example`,
    account: {
      id: `${source}-isolation-listener`,
      username: `${source}-isolation-listener`,
      role: roles[source] === "supervised" ? "user" : "admin",
      ...(roles[source] === "supervised" ? { parental_enabled: true } : {}),
    },
  });
  const owners = { local: owner("local"), server: owner("server") };
  const policies = {
    local: { ...parentalStatus(), owner: owners.local.account.id },
    server: { ...parentalStatus(), owner: owners.server.account.id },
  };
  for (const source of ["local", "server"] as const)
    policies[source].policy.enabled = roles[source] === "supervised";
  const refusals: Partial<Record<SourceId, Error>> = {};
  vi.mocked(loginAede).mockImplementation(async () => owners.server);
  vi.mocked(startLocal).mockImplementation(async () => owners.local);
  vi.mocked(syncAede).mockImplementation(async (source = "server") => ({
    server: owners[source].server,
    accountId: owners[source].account.id,
    scannedAt: 1,
    artists: [],
    albums: [],
    ...(roles[source] === "supervised"
      ? {
          parentalEnabled: true,
          parentalRevision: policies[source].revision,
          parentalPolicy: policies[source].policy,
        }
      : {}),
  }));
  vi.mocked(requestAede).mockImplementation(
    async (path, _query, _method, body, source = "server", captured) => {
      if (path === "/api/auth/v1/session") {
        if (refusals[source]) throw refusals[source];
        return { ...(captured ?? owners[source]).account, enabled: true };
      }
      if (path === "/api/me/v1/parental") return policies[source];
      if (path === "/api/me/v1/parental/lease") {
        if ((body as { action: string }).action === "release") return null;
        return {
          lease_id: `${source}:isolation-lease`,
          granted_seconds: 10,
          expires_at: 10,
          server_now_ms: 0,
        };
      }
      if (path === "/api/v1/status") return { capabilities: [] };
      return { items: [], total: 0, offset: 0, limit: 200, scanned_at: 1 };
    },
  );
  vi.mocked(resolveRadio).mockImplementation(async (uuid) => ({
    stationuuid: uuid,
    url: "https://radio.fixture.example/guest.mp3",
  }));
  vi.mocked(playbackStart).mockResolvedValue(undefined);
  vi.mocked(playbackControl).mockResolvedValue(undefined);
  vi.mocked(playbackState).mockResolvedValue(idlePlayback);
  const media: IsolationRadioMedia[] = [];
  vi.mocked(browserRadioMedia).mockImplementation(() => {
    const row = isolationMedia();
    media.push(row);
    return row;
  });
  const library = mountLibrary();
  return {
    library,
    owners,
    media,
    async signIn(source) {
      if (source === "local") await library.enableLocal();
      else await library.connect(owners.server.server, owners.server.account.username, "fixture");
      await settleParental();
    },
    refuse(source) {
      refusals[source] = new Error(`${source} session revoked (401)`);
    },
  };
}
export function namedAdmissionCalls(): Parameters<typeof requestAede>[] {
  return vi
    .mocked(requestAede)
    .mock.calls.filter(
      ([path]) => path === "/api/auth/v1/session" || path.startsWith("/api/me/v1/parental"),
    );
}

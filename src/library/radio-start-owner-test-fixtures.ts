import { expect, vi } from "vitest";
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

export const station = {
  uuid: "12345678-1234-1234-1234-123456789012",
  name: "Fixture Radio",
  country: "France",
  tags: "rock",
  codec: "MP3",
  bitrate: 128,
};
export const successorStation = { ...station, uuid: "12345678-1234-1234-1234-123456789013" };
export type StartBarrier = "handoff" | "volume" | "directory";
export function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((finish) => {
    resolve = finish;
  });
  return { promise, resolve };
}
export async function radioOwners(serverAllowed = true, localAllowed = true): Promise<RadioOwners> {
  const owner = (source: SourceId): AccountSession => ({
    nativeSession: `${source}-radio-session`,
    server: `https://${source}.fixture.example`,
    account: {
      id: `${source}-listener`,
      username: `${source}-listener`,
      role: "user",
      parental_enabled: true,
    },
  });
  const owners = { server: owner("server"), local: owner("local") };
  const policies = {
    server: { ...parentalStatus(), owner: owners.server.account.id },
    local: { ...parentalStatus(), owner: owners.local.account.id },
  };
  for (const source of ["server", "local"] as const) {
    policies[source].policy.enabled = true;
    policies[source].policy.radio_allowed = source === "server" ? serverAllowed : localAllowed;
  }
  vi.mocked(loginAede).mockImplementation(async () => owners.server);
  vi.mocked(startLocal).mockImplementation(async () => owners.local);
  vi.mocked(syncAede).mockImplementation(async (source = "server") => ({
    server: owners[source].server,
    accountId: owners[source].account.id,
    scannedAt: 1,
    artists: [],
    albums: [],
    parentalEnabled: true,
    parentalRevision: policies[source].revision,
    parentalPolicy: policies[source].policy,
  }));
  vi.mocked(requestAede).mockImplementation(
    async (path, _query, _method, body, source = "server", captured) => {
      const held = captured ?? owners[source];
      if (path === "/api/me/v1/parental") return { ...policies[source], owner: held.account.id };
      if (path === "/api/me/v1/parental/lease") {
        const action = (body as { action: string }).action;
        if (action === "release") return null;
        return {
          lease_id: `${source}:${held.nativeSession}:lease`,
          granted_seconds: 10,
          expires_at: 10,
          server_now_ms: 0,
        };
      }
      if (path === "/api/auth/v1/session") return { ...held.account, enabled: true };
      if (path === "/api/v1/status") return { capabilities: [] };
      return { items: [], total: 0, offset: 0, limit: 200, scanned_at: 1 };
    },
  );
  vi.mocked(resolveRadio).mockImplementation(async (uuid) => ({
    stationuuid: uuid,
    url: "https://radio.fixture.example/live.mp3",
  }));
  vi.mocked(playbackStart).mockResolvedValue(undefined);
  vi.mocked(playbackControl).mockResolvedValue(undefined);
  vi.mocked(playbackState).mockResolvedValue(idlePlayback);
  const media: ReturnType<typeof makeMedia>[] = [];
  vi.mocked(browserRadioMedia).mockImplementation(() => {
    const row = makeMedia();
    media.push(row);
    return row;
  });
  const library = mountLibrary();
  await library.connect(owners.server.server, owners.server.account.username, "fixture");
  await library.enableLocal();
  await settleParental();
  library.chooseSource("server");
  expect(library.serverSession()).toBe(owners.server);
  expect(library.localSession()).toBe(owners.local);
  expect(library.parental.available("server")).toBe(true);
  expect(library.parental.available("local")).toBe(true);
  return { library, owners, media };
}
function makeMedia(): FixtureRadioMedia {
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
export interface FixtureRadioMedia {
  source: Mock<RadioMedia["source"]>;
  volume: Mock<RadioMedia["volume"]>;
  play: Mock<RadioMedia["play"]>;
  release: Mock<RadioMedia["release"]>;
  callbacks: Mock<RadioMedia["callbacks"]>;
}
export interface RadioOwners {
  library: ReturnType<typeof mountLibrary>;
  owners: Record<SourceId, AccountSession>;
  media: FixtureRadioMedia[];
}
export interface HeldRadioStart {
  pending: Promise<void>;
  firstMedia: FixtureRadioMedia;
  finish: () => Promise<void>;
}
/** Hold actual provider wiring at native Stop, its real gain queue, or public station resolution. */
export async function holdRadioStart(
  fixture: RadioOwners,
  barrier: StartBarrier,
): Promise<HeldRadioStart> {
  const { library } = fixture;
  const entered = deferred<void>(),
    release = deferred<void>();
  let changing: Promise<void> | undefined;
  if (barrier === "handoff") {
    let status: "playing" | "idle" = "playing";
    vi.mocked(playbackState).mockImplementation(async () => ({
      ...idlePlayback,
      status,
      reference: status === "playing" ? "track:@phemios/server/fixture" : "",
      total: status === "playing" ? 1 : 0,
    }));
    await library.player.start(
      [
        {
          reference: "track:@phemios/server/fixture",
          title: "Fixture Track",
          duration_ms: 1000,
          analyses: [],
        },
      ],
      {
        reference: "release:@phemios/server/fixture",
        title: "Fixture Release",
        artist: null,
        year: null,
        compilation: false,
        tags: [],
      },
      "Fixture Artist",
    );
    expect(library.player.state().status).toBe("playing");
    vi.mocked(playbackControl).mockImplementation(async (command) => {
      if (command === "stop") {
        entered.resolve();
        await release.promise;
        status = "idle";
      }
    });
  } else if (barrier === "volume") {
    vi.mocked(playbackControl).mockImplementationOnce(async () => {
      entered.resolve();
      await release.promise;
    });
    changing = library.player.volume(0.4);
  } else {
    vi.mocked(resolveRadio).mockImplementationOnce(async (uuid) => {
      entered.resolve();
      await release.promise;
      return { stationuuid: uuid, url: "https://radio.fixture.example/held.mp3" };
    });
  }
  const pending = library.radio.start(station);
  await entered.promise;
  await settleParental();
  expect(library.radio.status()).toBe("connecting");
  const firstMedia = fixture.media.at(-1)!;
  expect(firstMedia.play).not.toHaveBeenCalled();
  return {
    pending,
    firstMedia,
    async finish() {
      release.resolve();
      await changing;
      await pending;
      await settleParental();
    },
  };
}
export function leaseCalls() {
  return vi.mocked(requestAede).mock.calls.filter(([path]) => path === "/api/me/v1/parental/lease");
}
export function leaseActions(action: string) {
  return leaseCalls().filter(([, , , body]) => (body as { action?: string })?.action === action);
}
export function expectLeaseOwner(action: string, source: SourceId, owner: AccountSession) {
  const calls = leaseActions(action);
  expect(calls.length).toBeGreaterThan(0);
  for (const [, , , body, target, captured] of calls) {
    expect(target).toBe(source);
    expect(captured).toBe(owner);
    if (action !== "reserve")
      expect((body as { lease_id: string }).lease_id).toBe(
        `${source}:${owner.nativeSession}:lease`,
      );
  }
}

import { createRoot, createSignal } from "solid-js";
import type { Setter } from "solid-js";
import { vi } from "vitest";
import type { Mock } from "vitest";
import type { requestAede } from "../platform/desktop";
import { createParentalAccess } from "./parental-access";
import { createParentalMedia } from "./parental-media";
import { parentalStatus } from "./parental-test-fixtures";
import type { AccountSession } from "./server";
import type { SourceId } from "./sources";

export function namedOwner(role = "admin", marker?: boolean): AccountSession {
  return {
    nativeSession: "named-media-session",
    server: "https://named.fixture.example",
    account: {
      id: "named-listener",
      username: "named-listener",
      role,
      ...(marker === undefined ? {} : { parental_enabled: marker }),
    },
  };
}
export function liveAccount(owner: AccountSession) {
  return { ...owner.account, enabled: true };
}
export interface NamedMediaFixture {
  access: ReturnType<typeof createParentalAccess>;
  guard: ReturnType<typeof createParentalMedia>;
  select: Setter<SourceId>;
  request: Mock<(...args: Parameters<typeof requestAede>) => Promise<unknown>>;
  stop: Mock<() => void>;
  error: Mock<(message: string) => void>;
  dispose: () => void;
  setLive: (value: unknown) => void;
  setPolicy: (value: unknown) => void;
}
/** The actual access/lease controllers share the same owner-scoped stop wiring as LibraryProvider. */
export function namedMedia(
  owner: AccountSession | undefined,
  initial?: { live: unknown; policy?: unknown },
): NamedMediaFixture {
  let live: unknown = initial ? initial.live : owner ? liveAccount(owner) : undefined;
  let policy: unknown = initial?.policy ?? {
    ...parentalStatus(),
    owner: owner?.account.id ?? "anonymous",
  };
  const request = vi
    .fn()
    .mockImplementation(
      async (
        path: string,
        _query: unknown,
        _method: string,
        body: unknown,
        _source: SourceId,
        _owner: AccountSession | undefined,
      ) => {
        if (path === "/api/auth/v1/session") {
          if (live instanceof Error) throw live;
          return live;
        }
        if (path === "/api/me/v1/parental") {
          if (policy instanceof Error) throw policy;
          return policy;
        }
        if (path === "/api/me/v1/parental/lease") {
          if ((body as { action: string }).action === "release") return null;
          return {
            lease_id: "named-listening-lease",
            granted_seconds: 10,
            expires_at: 10,
            server_now_ms: 0,
          };
        }
        throw Error("Unexpected named-media fixture route");
      },
    );
  const stop = vi.fn(),
    error = vi.fn();
  let dispose!: () => void;
  const controllers = createRoot((end) => {
    dispose = end;
    const [selected, select] = createSignal<SourceId>("server");
    let guard: ReturnType<typeof createParentalMedia> | undefined;
    const retire = (source: SourceId) => {
      if (guard?.applies(source)) {
        guard.stop();
        stop();
      }
    };
    const session = (source: SourceId) => (source === "server" ? owner : undefined);
    const access = createParentalAccess({
      session,
      source: selected,
      changed: retire,
      unavailable: retire,
      request,
    });
    guard = createParentalMedia({ access, session, source: selected, request, stop, error });
    return { access, guard, select };
  });
  return {
    ...controllers,
    request,
    stop,
    error,
    dispose,
    setLive(value: unknown) {
      live = value;
    },
    setPolicy(value: unknown) {
      policy = value;
    },
  };
}

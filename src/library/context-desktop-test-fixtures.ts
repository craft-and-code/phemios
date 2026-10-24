import { vi } from "vitest";
import type { AccountSession } from "./server";
/** Pure native bridge fixtures shared by provider integration suites; no server is contacted. */
export async function mockLibraryDesktop(): Promise<Record<string, unknown>> {
  const original =
    await vi.importActual<typeof import("../platform/desktop")>("../platform/desktop");
  return {
    ...original,
    isNative: () => false,
    loginAede: vi.fn(),
    startLocal: vi.fn(),
    restoreAedeSession: vi.fn(),
    setRequestSource: vi.fn(),
    stopLocal: vi.fn(async () => {}),
    logoutAede: vi.fn(async () => {}),
    syncAede: vi.fn(),
    requestAede: vi.fn(
      async (
        path: string,
        _query: unknown,
        _method: unknown,
        _body: unknown,
        _source: unknown,
        captured?: AccountSession,
      ) =>
        path === "/api/auth/v1/session"
          ? {
              ...(captured?.account ?? {
                id: "fixture-admin",
                username: "fixture-admin",
                role: "admin",
              }),
              enabled: true,
            }
          : path === "/api/v1/status"
            ? { capabilities: [] }
            : { items: [], total: 0, offset: 0, limit: 200, scanned_at: 1 },
    ),
  };
}

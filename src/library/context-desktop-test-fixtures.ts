import { vi } from "vitest";
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
    requestAede: vi.fn(async (path: string) =>
      path === "/api/v1/status"
        ? { capabilities: [] }
        : { items: [], total: 0, offset: 0, limit: 200, scanned_at: 1 },
    ),
  };
}

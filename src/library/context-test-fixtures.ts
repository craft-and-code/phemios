import { createRoot } from "solid-js";
import { afterEach, beforeEach, vi } from "vitest";
import { LibraryProvider, useLibrary } from "./context";
import { loginAede, startLocal, syncAede } from "../platform/desktop";
let dispose: (() => void) | undefined;
beforeEach(() => {
  vi.useFakeTimers();
  const values = new Map<string, string>();
  vi.stubGlobal("window", new EventTarget());
  vi.stubGlobal("document", { documentElement: { style: { setProperty: vi.fn() } } });
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  });
  const owner = {
    nativeSession: "fixture-session",
    server: "https://fixture.example",
    account: { id: "fixture-admin", username: "fixture-admin", role: "admin" },
  };
  vi.mocked(loginAede).mockResolvedValue(owner);
  vi.mocked(startLocal).mockResolvedValue(owner);
  vi.mocked(syncAede).mockResolvedValue({
    server: owner.server,
    accountId: owner.account.id,
    scannedAt: 1,
    artists: [],
    albums: [],
  });
});
afterEach(() => {
  dispose?.();
  dispose = undefined;
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  vi.restoreAllMocks();
});
export function mountLibrary(): ReturnType<typeof useLibrary> {
  let library!: ReturnType<typeof useLibrary>;
  createRoot((cleanup) => {
    dispose = cleanup;
    LibraryProvider({
      get children() {
        library = useLibrary();
        return undefined;
      },
    });
  });
  return library;
}

export function disposeLibrary() {
  dispose?.();
}

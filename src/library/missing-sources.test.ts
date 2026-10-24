import {
  createComponent,
  createMemo,
  createRoot,
  createSignal,
  Suspense,
  type JSX,
} from "solid-js";
import { afterEach, expect, it, vi } from "vitest";
import { createMissingCatalog } from "./missing";
import { requestAede } from "../platform/desktop";
import type { AccountSession } from "./server";
import type { SourceId } from "./sources";
vi.mock("../platform/desktop", () => ({ requestAede: vi.fn() }));
let dispose: () => void;
afterEach(() => {
  dispose?.();
  vi.resetAllMocks();
});
const owners = Object.fromEntries(
  ["local", "server"].map((source) => [
    source,
    {
      server: `https://${source}.example`,
      nativeSession: source,
      account: { id: source, username: source, role: "user" },
    },
  ]),
) as Record<SourceId, AccountSession>;
const row = (source: SourceId) => ({
  artist: `artist:@phemios/${source}/one`,
  artist_name: "One",
  release_group: "12345678-1234-1234-1234-123456789abc",
  title: "Missing",
  year: 2000,
  set_aside: false,
  source: "musicbrainz",
  url: "https://musicbrainz.org/release-group/12345678-1234-1234-1234-123456789abc",
});
const settle = async () => {
  for (let i = 0; i < 24; i++) await Promise.resolve();
};
const page = (source: SourceId) => ({ items: [row(source)], total: 1, scanned_at: 1 });
it("shows the local missing albums while the server is pending and does not reread local on server logout", async () => {
  let finish!: (value: unknown) => void;
  vi.mocked(requestAede).mockImplementation(
    async (path, _query, _method, _body, source = "server") => {
      if (path === "/api/v1/status") return { capabilities: ["missing_studio_albums"] };
      return source === "local"
        ? page(source)
        : new Promise((resolve) => {
            finish = resolve;
          });
    },
  );
  const [server, setServer] = createSignal<AccountSession | undefined>(owners.server);
  const missing = createRoot((end) => {
    dispose = end;
    return createMissingCatalog(
      () => owners.local,
      server,
      () => 1,
    );
  });
  await settle();
  expect(missing.rows()).toEqual([row("local")]);
  const localReads = vi.mocked(requestAede).mock.calls.filter((call) => call[4] === "local").length;
  setServer(undefined);
  finish(page("server"));
  await settle();
  expect(missing.rows()).toEqual([row("local")]);
  expect(vi.mocked(requestAede).mock.calls.filter((call) => call[4] === "local")).toHaveLength(
    localReads,
  );
});
it("does not retire a server decision or reread its catalogue when the local catalogue changes", async () => {
  let finish!: () => void;
  vi.mocked(requestAede).mockImplementation(
    async (path, _query, method, _body, source = "server") => {
      if (method === "PUT")
        return new Promise<void>((resolve) => {
          finish = resolve;
        });
      return path === "/api/v1/status" ? { capabilities: ["missing_studio_albums"] } : page(source);
    },
  );
  const [localEpoch, setLocalEpoch] = createSignal(1);
  const missing = createRoot((end) => {
    dispose = end;
    return createMissingCatalog(
      () => owners.local,
      () => owners.server,
      (source: SourceId) => (source === "local" ? localEpoch() : 1),
    );
  });
  await settle();
  const decision = missing.decide(row("server"), true);
  const verdict = expect(decision).resolves.toBeUndefined();
  const serverReads = vi
    .mocked(requestAede)
    .mock.calls.filter((call) => call[4] === "server" && call[2] === "GET").length;
  try {
    setLocalEpoch(2);
    await settle();
    expect(
      vi.mocked(requestAede).mock.calls.filter((call) => call[4] === "server" && call[2] === "GET"),
    ).toHaveLength(serverReads);
  } finally {
    finish();
    await verdict;
  }
});

it("keeps ready local suggestions visible inside the workspace while server suggestions load", async () => {
  vi.mocked(requestAede).mockImplementation(
    async (path, _query, _method, _body, source = "server") => {
      if (path === "/api/v1/status") return { capabilities: ["missing_studio_albums"] };
      return source === "local" ? page(source) : new Promise(() => {});
    },
  );
  const view = createRoot((end) => {
    dispose = end;
    return createComponent(Suspense, {
      fallback: "whole-page-loader",
      get children() {
        const missing = createMissingCatalog(
          () => owners.local,
          () => owners.server,
          () => 1,
        );
        return createMemo(() =>
          missing
            .rows()
            .map((item) => item.artist)
            .join("|"),
        ) as unknown as JSX.Element;
      },
    });
  });
  await settle();
  let rendered: unknown = view;
  while (typeof rendered === "function") rendered = rendered();
  expect(rendered).toBe(row("local").artist);
});

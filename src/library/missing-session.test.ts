import { createRoot, createSignal } from "solid-js";
import { afterEach, expect, it, vi } from "vitest";
import { createMissingCatalog } from "./missing";
import { requestAede } from "../platform/desktop";
import type { AccountSession } from "./server";
vi.mock("../platform/desktop", () => ({ requestAede: vi.fn() }));
afterEach(() => vi.resetAllMocks());
const owner: AccountSession = {
  server: "https://music.example",
  account: { id: "first", username: "first", role: "user" },
};
const row = {
  artist: "artist:one",
  artist_name: "One",
  release_group: "12345678-1234-1234-1234-123456789abc",
  title: "Missing",
  year: 2000,
  set_aside: true,
  source: "musicbrainz",
  url: "https://musicbrainz.org/release-group/12345678-1234-1234-1234-123456789abc",
};
async function settle() {
  for (let i = 0; i < 20; i++) await Promise.resolve();
}
it("does not request private missing decisions after logout during its capability read", async () => {
  let finish!: (raw: unknown) => void;
  vi.mocked(requestAede)
    .mockImplementationOnce(
      () =>
        new Promise((done) => {
          finish = done;
        }),
    )
    .mockResolvedValue({ items: [], total: 0, scanned_at: 1 });
  const [session, setSession] = createSignal<AccountSession | undefined>(owner);
  let dispose!: () => void;
  const missing = createRoot((end) => {
    dispose = end;
    return createMissingCatalog(
      () => undefined,
      session,
      () => 1,
    );
  });
  try {
    await settle();
    setSession(undefined);
    finish({ capabilities: ["missing_studio_albums"] });
    await settle();
    expect(requestAede).toHaveBeenCalledTimes(1);
    expect(missing.rows()).toEqual([]);
  } finally {
    dispose();
  }
});
it("hides former private missing decisions on logout and re-login with the same session object", async () => {
  vi.mocked(requestAede).mockImplementation(async (path) =>
    path === "/api/v1/status"
      ? { capabilities: ["missing_studio_albums"] }
      : { items: [row], total: 1, scanned_at: 1 },
  );
  const [session, setSession] = createSignal<AccountSession | undefined>(owner);
  let dispose!: () => void;
  const missing = createRoot((end) => {
    dispose = end;
    return createMissingCatalog(
      () => undefined,
      session,
      () => 1,
    );
  });
  try {
    await settle();
    expect(missing.rows()[0]?.set_aside).toBe(true);
    setSession(undefined);
    vi.mocked(requestAede).mockImplementationOnce(() => new Promise(() => {}));
    setSession(owner);
    expect(missing.rows()).toEqual([]);
  } finally {
    dispose();
  }
});

it.each(["logout", "dispose"])(
  "stops missing-suggestion pagination after %s during a full first page",
  async (boundary) => {
    let finish!: (raw: unknown) => void;
    vi.mocked(requestAede)
      .mockResolvedValueOnce({ capabilities: ["missing_studio_albums"] })
      .mockImplementationOnce(
        () =>
          new Promise((done) => {
            finish = done;
          }),
      );
    const [session, setSession] = createSignal<AccountSession | undefined>(owner);
    let dispose!: () => void;
    const missing = createRoot((end) => {
      dispose = end;
      return createMissingCatalog(
        () => undefined,
        session,
        () => 1,
      );
    });
    try {
      await settle();
      expect(requestAede).toHaveBeenCalledTimes(2);
      if (boundary === "logout") setSession(undefined);
      else dispose();
      finish({
        total: 201,
        scanned_at: 1,
        items: Array.from({ length: 200 }, (_, index) => {
          const group = `${index.toString(16).padStart(8, "0")}-1234-1234-1234-123456789abc`;
          return {
            ...row,
            release_group: group,
            url: `https://musicbrainz.org/release-group/${group}`,
          };
        }),
      });
      await settle();
      expect(requestAede).toHaveBeenCalledTimes(2);
      expect(missing.rows()).toEqual([]);
      expect(missing.errors()).toEqual([]);
    } finally {
      dispose();
    }
  },
);

import { createRoot, createSignal } from "solid-js";
import { expect, it, vi } from "vitest";
import { createFavouriteControl } from "./favourite-control";
import { requestAede } from "../platform/desktop";
import type { AccountSession } from "./server";
vi.mock("../platform/desktop", () => ({ requestAede: vi.fn() }));
const session: AccountSession = {
  server: "http://127.0.0.1:3422",
  account: { id: "test", username: "listener", role: "user" },
};
it("writes only the playing track favourite to its source, and ignores a late answer after Next", async () => {
  let finish!: (v: unknown) => void;
  vi.mocked(requestAede).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const publish = vi.fn();
  let dispose!: () => void;
  const control = createRoot((cleanup) => {
    dispose = cleanup;
    const [ref, setRef] = createSignal("track:@phemios/local/one");
    return {
      setRef,
      heart: createFavouriteControl(
        ref,
        () => session,
        () => false,
        publish,
      ),
    };
  });
  try {
    const pending = control.heart.toggle();
    await Promise.resolve();
    expect(requestAede).toHaveBeenCalledWith(
      "/api/me/v1/annotation",
      { ref: "track:@phemios/local/one" },
      "PUT",
      { loved: true },
      "local",
    );
    control.setRef("track:@phemios/server/two");
    finish({
      annotation: {
        reference: "track:@phemios/local/one",
        loved: true,
        rating: 4,
        note: "Keep",
        tags: ["keep"],
      },
    });
    await pending;
    expect(publish).not.toHaveBeenCalled();
    expect(control.heart.busy()).toBe(false);
  } finally {
    dispose();
  }
});
it("refuses absent or read-only sessions, reports failure, and toggles a saved heart off", async () => {
  vi.mocked(requestAede).mockReset();
  const publish = vi.fn();
  let dispose!: () => void;
  const control = createRoot((cleanup) => {
    dispose = cleanup;
    const [account, setAccount] = createSignal<AccountSession>();
    return {
      setAccount,
      heart: createFavouriteControl(
        () => "track:one",
        account,
        () => true,
        publish,
      ),
    };
  });
  try {
    await control.heart.toggle();
    control.setAccount({ ...session, account: { ...session.account, role: "auditor" } });
    await control.heart.toggle();
    expect(requestAede).not.toHaveBeenCalled();
    control.setAccount(session);
    vi.mocked(requestAede).mockRejectedValueOnce(new Error("Offline"));
    await control.heart.toggle();
    expect(control.heart.error()).toBe("Offline");
    expect(publish).not.toHaveBeenCalled();
    vi.mocked(requestAede).mockResolvedValueOnce({ annotation: null });
    await control.heart.toggle();
    expect(requestAede).toHaveBeenLastCalledWith(
      "/api/me/v1/annotation",
      { ref: "track:one" },
      "PUT",
      { loved: false },
      "server",
    );
    expect(publish).toHaveBeenCalledWith("track:one", null);
  } finally {
    dispose();
  }
});

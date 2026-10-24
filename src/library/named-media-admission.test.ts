import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { namedMedia, namedOwner, liveAccount } from "./named-media-admission-test-fixtures";
import { parentalStatus, settleParental } from "./parental-test-fixtures";
beforeEach(() =>
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date", "performance"] }),
);
afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
});

it("PH-010 admits a named current administrator only after an exact live-session read", async () => {
  const owner = namedOwner(),
    fixture = namedMedia(owner);
  try {
    await fixture.guard.authorize({ kind: "radio" });
    fixture.guard.observe("playing");
    expect(fixture.request.mock.calls.some(([path]) => path === "/api/auth/v1/session")).toBe(true);
    for (const [path, , , , source, captured] of fixture.request.mock.calls) {
      expect(path).toBe("/api/auth/v1/session");
      expect(source).toBe("server");
      expect(captured).toBe(owner);
    }
    expect(fixture.guard.owner()).toBe(owner);
    expect(fixture.guard.source()).toBe("server");
    expect(fixture.access.available("server")).toBe(true);
    expect(fixture.access.status("server")).toBeUndefined();
  } finally {
    fixture.dispose();
  }
});

const invalidLive = [
  { label: "HTTP 401", value: new Error("Session absent or expired (401)") },
  { label: "HTTP 403", value: new Error("Account refused (403)") },
  {
    label: "demotion",
    value: { ...liveAccount(namedOwner()), role: "user", parental_enabled: true },
  },
  { label: "foreign identity", value: { ...liveAccount(namedOwner()), id: "other-listener" } },
  { label: "disabled", value: { ...liveAccount(namedOwner()), enabled: false } },
  { label: "malformed", value: {} },
  { label: "invalid enabled marker", value: { ...liveAccount(namedOwner()), enabled: "true" } },
];
it.each(invalidLive)(
  "PH-010 refuses cached admin listening after $label without adopting a guest exemption",
  async ({ value }) => {
    const fixture = namedMedia(namedOwner(), { live: value });
    try {
      await expect(fixture.guard.authorize({ kind: "radio" })).rejects.toThrow();
      expect(fixture.access.available("server")).toBe(false);
      expect(fixture.access.radioAllowed()).toBe(false);
      expect(
        fixture.request.mock.calls.filter(([path]) => path === "/api/me/v1/parental/lease"),
      ).toHaveLength(0);
    } finally {
      fixture.dispose();
    }
  },
);

it.each(["explicit refresh", "policy poll"])(
  "PH-010 retires retained named radio on revoked authority through %s after a source change",
  async (mode) => {
    const owner = namedOwner(),
      fixture = namedMedia(owner);
    try {
      await fixture.guard.authorize({ kind: "radio" });
      fixture.guard.observe("playing");
      fixture.select("local");
      fixture.setLive(new Error("Session revoked (401)"));
      if (mode === "explicit refresh") await fixture.access.refresh("server").catch(() => {});
      else await vi.advanceTimersByTimeAsync(5000);
      expect(fixture.stop).toHaveBeenCalledOnce();
      expect(fixture.guard.owner()).toBeUndefined();
      expect(fixture.access.available("server")).toBe(false);
      expect(
        fixture.request.mock.calls.filter(([path]) => path === "/api/me/v1/parental/lease"),
      ).toHaveLength(0);
    } finally {
      fixture.dispose();
    }
  },
);

it("PH-010 repeated named starts recheck live authority rather than reuse an earlier admin allowance", async () => {
  const fixture = namedMedia(namedOwner());
  try {
    await fixture.guard.authorize({ kind: "radio" });
    await settleParental();
    fixture.setLive({ ...liveAccount(namedOwner()), role: "user", parental_enabled: true });
    await expect(fixture.guard.authorize({ kind: "radio" })).rejects.toThrow();
    expect(fixture.access.available("server")).toBe(false);
  } finally {
    fixture.dispose();
  }
});

it("PH-010 validates a legacy named account without fabricating a disabled parental policy", async () => {
  const owner = namedOwner("user", undefined),
    fixture = namedMedia(owner);
  try {
    await fixture.guard.authorize({ kind: "radio" });
    expect(fixture.request.mock.calls.some(([path]) => path === "/api/auth/v1/session")).toBe(true);
    expect(fixture.request.mock.calls.every(([path]) => path === "/api/auth/v1/session")).toBe(
      true,
    );
    expect(fixture.access.status("server")).toBeUndefined();
    expect(fixture.access.supported("server")).toBe(false);
    expect(fixture.access.available("server")).toBe(true);
    expect(fixture.guard.owner()).toBe(owner);
  } finally {
    fixture.dispose();
  }
});

it("PH-010 learns live parental capability before allowing an old markerless named login", async () => {
  const owner = namedOwner("user", undefined),
    fixture = namedMedia(owner, {
      live: { ...liveAccount(owner), parental_enabled: true },
      policy: {
        ...parentalStatus(),
        owner: owner.account.id,
        policy: { ...parentalStatus().policy, enabled: true, radio_allowed: false },
      },
    });
  try {
    await expect(fixture.guard.authorize({ kind: "radio" })).rejects.toThrow("radios");
    expect(fixture.request.mock.calls.some(([path]) => path === "/api/me/v1/parental")).toBe(true);
    expect(fixture.access.status("server")?.policy.enabled).toBe(true);
  } finally {
    fixture.dispose();
  }
});

it.each(["refused", "malformed marker"])(
  "PH-010 fails closed for a legacy named account with %s live admission",
  async (kind) => {
    const owner = namedOwner("user", undefined),
      fixture = namedMedia(owner, {
        live:
          kind === "refused"
            ? new Error("Session revoked (401)")
            : { ...liveAccount(owner), parental_enabled: "false" },
      });
    try {
      await expect(fixture.guard.authorize({ kind: "radio" })).rejects.toThrow();
      expect(fixture.access.available("server")).toBe(false);
    } finally {
      fixture.dispose();
    }
  },
);

it("PH-010 leaves retained public catalogue readable when a named admin session is unavailable", async () => {
  const owner = namedOwner(),
    fixture = namedMedia(owner, { live: new Error("Offline") });
  const snapshot = {
    server: owner.server,
    accountId: owner.account.id,
    artists: [],
    albums: [],
    scannedAt: 1,
  };
  try {
    await fixture.access.refresh("server").catch(() => {});
    expect(fixture.access.catalogVisible("server", snapshot)).toBe(true);
    await expect(fixture.access.check({ kind: "radio" })).rejects.toThrow();
  } finally {
    fixture.dispose();
  }
});

it("PH-010 keeps explicit anonymous guest listening independent of named-account admission", async () => {
  const fixture = namedMedia(undefined);
  try {
    await fixture.guard.authorize({ kind: "radio" });
    fixture.guard.observe("playing");
    await vi.advanceTimersByTimeAsync(20000);
    expect(fixture.request).not.toHaveBeenCalled();
    expect(fixture.stop).not.toHaveBeenCalled();
    expect(fixture.access.available()).toBe(true);
    expect(fixture.access.radioAllowed()).toBe(true);
    expect(fixture.access.status()).toBeUndefined();
  } finally {
    fixture.dispose();
  }
});

import { expect, it, vi } from "vitest";
import {
  guestStation,
  isolationDeferred,
  namedAdmissionCalls,
  radioIsolation,
} from "./guest-radio-isolation-test-fixtures";
import { requestAede, resolveRadio } from "../platform/desktop";
import { settleParental } from "./parental-test-fixtures";
vi.mock("../platform/desktop", async () => {
  const { mockLibraryDesktop } = await import("./context-desktop-test-fixtures");
  return {
    ...(await mockLibraryDesktop()),
    resolveRadio: vi.fn(),
    playbackStart: vi.fn(),
    playbackControl: vi.fn(),
    playbackState: vi.fn(),
  };
});
vi.mock("../radio/playback", async (original) => ({
  ...(await original<typeof import("../radio/playback")>()),
  browserRadioMedia: vi.fn(),
}));

it.each(["local", "server"] as const)(
  "PH-011 keeps guest radio playing when an unrelated %s administrator's live refresh fails",
  async (namedSource) => {
    const fixture = radioIsolation(),
      { library } = fixture,
      guestSource = namedSource === "local" ? "server" : "local";
    library.chooseSource(guestSource);
    expect(library.source()).toBe(guestSource);
    expect(library.session()).toBeUndefined();
    expect(library.localSession()).toBeUndefined();
    expect(library.serverSession()).toBeUndefined();
    await library.radio.start(guestStation);
    const media = fixture.media[0]!;
    expect(library.radio.status()).toBe("playing");
    expect(media.play).toHaveBeenCalledOnce();
    expect(namedAdmissionCalls()).toHaveLength(0);

    await fixture.signIn(namedSource);
    expect(library.source()).toBe(namedSource);
    expect(library.session()).toBe(fixture.owners[namedSource]);
    expect(library.parental.available(namedSource)).toBe(true);
    expect(library.radio.status()).toBe("playing");
    expect(media.release).not.toHaveBeenCalled();
    vi.mocked(requestAede).mockClear();
    fixture.refuse(namedSource);
    await expect(library.parental.refresh(namedSource)).rejects.toThrow("session revoked");
    await settleParental();
    expect(library.parental.available(namedSource)).toBe(false);
    expect(namedAdmissionCalls()).toHaveLength(1);
    expect(namedAdmissionCalls()[0]?.[0]).toBe("/api/auth/v1/session");
    expect(namedAdmissionCalls()[0]?.[4]).toBe(namedSource);
    expect(namedAdmissionCalls()[0]?.[5]).toBe(fixture.owners[namedSource]);
    expect(library.radio.status()).toBe("playing");
    expect(library.radio.station()?.uuid).toBe(guestStation.uuid);
    expect(media.release).not.toHaveBeenCalled();
    expect(media.play).toHaveBeenCalledOnce();
    expect(fixture.media).toHaveLength(1);
  },
);

it.each(["local", "server"] as const)(
  "PH-011 retains named %s radio across an unrelated refusal and stops it for its own refusal",
  async (capturedSource) => {
    const fixture = radioIsolation(),
      { library } = fixture,
      otherSource = capturedSource === "local" ? "server" : "local";
    await fixture.signIn("server");
    await fixture.signIn("local");
    library.chooseSource(capturedSource);
    expect(library.source()).toBe(capturedSource);
    expect(library.session()).toBe(fixture.owners[capturedSource]);
    await library.radio.start(guestStation);
    const media = fixture.media[0]!;
    expect(library.radio.status()).toBe("playing");
    library.chooseSource(otherSource);
    expect(library.source()).toBe(otherSource);
    fixture.refuse(otherSource);
    await expect(library.parental.refresh(otherSource)).rejects.toThrow("session revoked");
    await settleParental();
    expect(library.radio.status()).toBe("playing");
    expect(library.radio.station()?.uuid).toBe(guestStation.uuid);
    expect(media.release).not.toHaveBeenCalled();

    fixture.refuse(capturedSource);
    await expect(library.parental.refresh(capturedSource)).rejects.toThrow("session revoked");
    await settleParental();
    expect(library.radio.status()).toBe("idle");
    expect(library.radio.station()).toBeUndefined();
    expect(media.release).toHaveBeenCalledOnce();
    expect(media.play).toHaveBeenCalledOnce();
    expect(
      vi.mocked(requestAede).mock.calls.filter(([path]) => path === "/api/me/v1/parental/lease"),
    ).toHaveLength(0);
  },
);

it("PH-011 keeps actual-provider guest listening free of named admission and polling requests", async () => {
  const { library, media } = radioIsolation();
  expect(library.source()).toBe("server");
  expect(library.session()).toBeUndefined();
  await library.radio.start(guestStation);
  await vi.advanceTimersByTimeAsync(15000);
  expect(library.radio.status()).toBe("playing");
  expect(namedAdmissionCalls()).toHaveLength(0);
  expect(media[0]!.release).not.toHaveBeenCalled();
  library.radio.stop();
  await vi.advanceTimersByTimeAsync(5000);
  expect(library.radio.status()).toBe("idle");
  expect(media[0]!.release).toHaveBeenCalledOnce();
  expect(namedAdmissionCalls()).toHaveLength(0);
});

it.each(["local", "server"] as const)(
  "PH-011 retires guest radio when its source logs into a supervised %s account",
  async (source) => {
    const fixture = radioIsolation({ [source]: "supervised" }),
      { library } = fixture;
    library.chooseSource(source);
    expect(library.source()).toBe(source);
    expect(library.session()).toBeUndefined();
    await library.radio.start(guestStation);
    const media = fixture.media[0]!;
    expect(library.radio.status()).toBe("playing");
    await fixture.signIn(source);
    expect(library.source()).toBe(source);
    expect(library.session()).toBe(fixture.owners[source]);
    expect(library.parental.status(source)?.policy.enabled).toBe(true);
    expect(library.radio.status()).toBe("idle");
    expect(media.release).toHaveBeenCalledOnce();
    expect(media.play).toHaveBeenCalledOnce();
    expect(
      vi.mocked(requestAede).mock.calls.filter(([path]) => path === "/api/me/v1/parental/lease"),
    ).toHaveLength(0);
  },
);

it("PH-011 cannot revive an explicitly stopped guest start after deferred directory resolution", async () => {
  const fixture = radioIsolation(),
    { library } = fixture,
    entered = isolationDeferred<void>(),
    resolved = isolationDeferred<void>();
  vi.mocked(resolveRadio).mockImplementationOnce(async (uuid) => {
    entered.resolve();
    await resolved.promise;
    return { stationuuid: uuid, url: "https://radio.fixture.example/late-guest.mp3" };
  });
  const pending = library.radio.start(guestStation);
  try {
    await entered.promise;
    expect(library.radio.status()).toBe("connecting");
    library.radio.stop();
    expect(library.radio.status()).toBe("idle");
    resolved.resolve();
    await pending;
    await settleParental();
    expect(library.radio.status()).toBe("idle");
    expect(library.radio.station()).toBeUndefined();
    expect(fixture.media[0]!.play).not.toHaveBeenCalled();
    expect(fixture.media[0]!.release).toHaveBeenCalledOnce();
    expect(namedAdmissionCalls()).toHaveLength(0);
  } finally {
    resolved.resolve();
    await pending;
  }
});

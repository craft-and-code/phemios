import { createRoot, createSignal } from "solid-js";
import { expect, it, vi } from "vitest";
import { createRadioPlayback } from "./playback";
import { createRadioTuner, radioTuningKey } from "./tuner";
import type { Station } from "./directory";
const rows: Station[] = [0, 1, 2, 3].map((index) => ({
  uuid: `12345678-1234-1234-1234-12345678901${index}`,
  name: `Fictional station ${index}`,
  country: "France",
  countryCode: "FR",
  tags: "rock",
  codec: "MP3",
  bitrate: 128,
}));
function setup(initial = "playing") {
  const [stations, setStations] = createSignal<readonly Station[]>(rows),
    [station, setStation] = createSignal<Station | undefined>(
      initial === "idle" ? undefined : rows[0],
    ),
    [status, setStatus] = createSignal(initial),
    [selected, setSelected] = createSignal(0);
  const start = vi.fn(async (next: Station) => {
    setStation(next);
    setStatus("connecting");
  });
  const tuner = createRadioTuner({ stations, station, status, select: setSelected, start });
  return { tuner, stations, setStations, station, setStation, status, setStatus, selected, start };
}
it("retunes once to the final dragged station while an account-independent radio is playing", async () => {
  await createRoot(async (dispose) => {
    const view = setup();
    try {
      await Promise.resolve();
      view.tuner.begin();
      for (const index of [1, 2, 1, 3]) view.tuner.preview(index);
      expect(view.selected()).toBe(3);
      expect(view.start).not.toHaveBeenCalled();
      view.tuner.finish();
      expect(view.start).toHaveBeenCalledExactlyOnceWith(rows[3]);
      view.tuner.change(); // A native change may follow pointerup.
      view.tuner.finish();
      expect(view.start).toHaveBeenCalledOnce();
    } finally {
      dispose();
    }
  });
});
it("coalesces held range keys until release and lets a click retune a connecting station", async () => {
  await createRoot(async (dispose) => {
    const view = setup();
    try {
      await Promise.resolve();
      view.tuner.begin();
      for (const index of [1, 2, 3]) {
        view.tuner.begin();
        view.tuner.preview(index);
        view.tuner.change();
      }
      expect(view.start).not.toHaveBeenCalled();
      view.tuner.finish();
      expect(view.start).toHaveBeenCalledExactlyOnceWith(rows[3]);
      view.tuner.choose(1);
      expect(view.start).toHaveBeenCalledTimes(2);
      expect(view.start).toHaveBeenLastCalledWith(rows[1]);
    } finally {
      dispose();
    }
  });
});
it("never autoplays an idle paused or failed transport on a dial or list selection", async () => {
  for (const state of ["idle", "paused", "error"])
    await createRoot(async (dispose) => {
      const view = setup(state);
      try {
        await Promise.resolve();
        view.tuner.begin();
        view.tuner.preview(2);
        view.tuner.finish();
        view.tuner.choose(3);
        expect(view.selected()).toBe(3);
        expect(view.start).not.toHaveBeenCalled();
      } finally {
        dispose();
      }
    });
});
it("drops a cancelled or replaced page gesture and refuses invalid station indices", async () => {
  await createRoot(async (dispose) => {
    const view = setup();
    try {
      await Promise.resolve();
      view.tuner.begin();
      view.tuner.preview(2);
      view.tuner.cancel();
      view.tuner.change();
      view.tuner.finish();
      expect(view.start).not.toHaveBeenCalled();
      view.tuner.begin();
      view.tuner.preview(3);
      view.setStations([...rows]);
      view.tuner.change();
      view.tuner.finish();
      expect(view.start).not.toHaveBeenCalled();
      for (const index of [-1, 90, NaN, 1.5]) view.tuner.choose(index);
      expect(view.selected()).toBe(3);
      expect(view.start).not.toHaveBeenCalled();
    } finally {
      dispose();
    }
  });
});
it("cannot revive a stopped radio, replace a later transport action or tune after disposal", async () => {
  await createRoot(async (dispose) => {
    const view = setup();
    await Promise.resolve();
    view.tuner.begin();
    view.tuner.preview(2);
    view.setStatus("paused");
    view.setStatus("playing");
    view.tuner.finish();
    expect(view.start).not.toHaveBeenCalled();
    view.tuner.begin();
    view.tuner.preview(3);
    view.setStation(rows[1]);
    view.tuner.finish();
    expect(view.start).not.toHaveBeenCalled();
    view.tuner.begin();
    view.tuner.preview(2);
    dispose();
    view.tuner.finish();
    view.tuner.choose(3);
    expect(view.start).not.toHaveBeenCalled();
  });
});
it("does not restart the audible station and keeps ordinary shortcut keys outside tuner gestures", async () => {
  await createRoot(async (dispose) => {
    const view = setup();
    try {
      await Promise.resolve();
      view.tuner.choose(0);
      expect(view.start).not.toHaveBeenCalled();
      expect(radioTuningKey("ArrowRight")).toBe(true);
      expect(radioTuningKey("Home")).toBe(true);
      for (const key of [" ", "Enter", "Escape", "a"]) expect(radioTuningKey(key)).toBe(false);
    } finally {
      dispose();
    }
  });
});

it("commits an accessibility input/change pair without reviving a cancelled native change", async () => {
  await createRoot(async (dispose) => {
    const view = setup();
    try {
      await Promise.resolve();
      view.tuner.preview(2);
      expect(view.start).not.toHaveBeenCalled();
      view.tuner.change();
      expect(view.start).toHaveBeenCalledExactlyOnceWith(rows[2]);
      view.tuner.begin();
      view.tuner.preview(3);
      view.tuner.cancel();
      view.tuner.change();
      expect(view.start).toHaveBeenCalledOnce();
    } finally {
      dispose();
    }
  });
});

it("hands only the final dial choice to the real stream controller after explicit radio playback", async () => {
  await createRoot(async (dispose) => {
    const resolve = vi.fn(async (uuid: string) => ({
      stationuuid: uuid,
      url: "https://radio.example/live.mp3",
    }));
    const released = vi.fn();
    const radio = createRadioPlayback(
      resolve,
      async () => {},
      () => {
        let ready = () => {};
        return {
          source: () => {},
          volume: () => {},
          release: released,
          callbacks: (playing) => {
            ready = playing;
          },
          play: async () => {
            ready();
          },
        };
      },
    );
    const tuner = createRadioTuner({
      stations: () => rows,
      select: () => {},
      station: radio.station,
      status: radio.status,
      start: radio.start,
    });
    try {
      await radio.start(rows[0]!);
      expect(radio.status()).toBe("playing");
      tuner.begin();
      for (const index of [1, 2, 3]) tuner.preview(index);
      expect(resolve).toHaveBeenCalledOnce();
      expect(released).not.toHaveBeenCalled();
      tuner.finish();
      for (let step = 0; step < 8; step++) await Promise.resolve();
      expect(resolve).toHaveBeenCalledTimes(2);
      expect(resolve).toHaveBeenLastCalledWith(rows[3]!.uuid);
      expect(released).toHaveBeenCalledOnce();
      expect(radio.station()).toBe(rows[3]);
      expect(radio.status()).toBe("playing");
    } finally {
      dispose();
    }
  });
});

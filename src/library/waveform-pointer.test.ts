import { createRoot, createSignal } from "solid-js";
import { expect, it, vi } from "vitest";
import { idlePlayback } from "./playback-state";
import { createWaveformPointer } from "./waveform-pointer";
it.each(["track", "occurrence", "queue", "disabled", "cancel", "dispose"])(
  "does not commit an abandoned pointer gesture after %s",
  (change) =>
    createRoot((dispose) => {
      const [state, setState] = createSignal({ ...idlePlayback, reference: "track:one" }),
        [disabled, setDisabled] = createSignal(false),
        seek = vi.fn(),
        clear = vi.fn(),
        preview = vi.fn();
      const target = {
        focus: vi.fn(),
        setPointerCapture: vi.fn(),
        releasePointerCapture: vi.fn(),
        hasPointerCapture: () => true,
      } as unknown as HTMLInputElement;
      const event = {
        button: 0,
        pointerId: 1,
        currentTarget: target,
        preventDefault: vi.fn(),
      } as unknown as PointerEvent & { currentTarget: HTMLInputElement };
      const gesture = createWaveformPointer({
        state,
        disabled,
        seek,
        clear,
        preview,
        hover: vi.fn(),
        position: () => 5000,
      });
      gesture.down(event);
      if (change === "track") setState((s) => ({ ...s, reference: "track:two" }));
      if (change === "occurrence") setState((s) => ({ ...s, index: 1 }));
      if (change === "queue") setState((s) => ({ ...s, queue_id: 1 }));
      if (change === "disabled") setDisabled(true);
      if (change === "cancel") gesture.cancel();
      if (change === "dispose") dispose();
      gesture.up(event);
      expect(seek).not.toHaveBeenCalled();
      dispose();
    }),
);

it("keeps a live gesture across clock and pause updates and commits only its pointer", () => {
  createRoot((dispose) => {
    const [state, setState] = createSignal({ ...idlePlayback, reference: "track:one" });
    const seek = vi.fn(),
      preview = vi.fn(),
      clear = vi.fn();
    let captured = false,
      position = 1000;
    const release = vi.fn(() => {
      captured = false;
    });
    const target = {
      focus: vi.fn(),
      setPointerCapture: () => {
        captured = true;
      },
      releasePointerCapture: release,
      hasPointerCapture: () => captured,
    } as unknown as HTMLInputElement;
    const event = {
      button: 0,
      pointerId: 1,
      currentTarget: target,
      preventDefault: vi.fn(),
    } as unknown as PointerEvent & { currentTarget: HTMLInputElement };
    const gesture = createWaveformPointer({
      state,
      disabled: () => false,
      seek,
      clear,
      preview,
      hover: vi.fn(),
      position: () => position,
    });
    gesture.down(event);
    expect(preview).toHaveBeenLastCalledWith(1000);
    setState((s) => ({ ...s, position_ms: 2000, status: "paused" }));
    position = 4000;
    gesture.move(event);
    expect(preview).toHaveBeenLastCalledWith(4000);
    gesture.up({ ...event, pointerId: 2 });
    expect(seek).not.toHaveBeenCalled();
    gesture.up(event);
    expect(seek).toHaveBeenCalledExactlyOnceWith(4000);
    expect(release).toHaveBeenCalledExactlyOnceWith(1);
    gesture.up(event);
    expect(seek).toHaveBeenCalledTimes(1);
    dispose();
  });
});

it("keeps the original waveform gesture when another touch reaches the control", () => {
  createRoot((dispose) => {
    const [state] = createSignal({ ...idlePlayback, reference: "track:one" });
    const seek = vi.fn(),
      preview = vi.fn(),
      hover = vi.fn();
    const captured = new Set<number>();
    const target = {
      focus: vi.fn(),
      setPointerCapture: (id: number) => captured.add(id),
      releasePointerCapture: (id: number) => captured.delete(id),
      hasPointerCapture: (id: number) => captured.has(id),
    } as unknown as HTMLInputElement;
    const pointer = (id: number, x: number, primary = true) =>
      ({
        button: 0,
        pointerId: id,
        isPrimary: primary,
        clientX: x,
        currentTarget: target,
        preventDefault: vi.fn(),
      }) as unknown as PointerEvent & { currentTarget: HTMLInputElement };
    const gesture = createWaveformPointer({
      state,
      disabled: () => false,
      seek,
      preview,
      hover,
      position: (event) => event.clientX,
      clear: vi.fn(),
    });
    gesture.down(pointer(1, 1000));
    gesture.down(pointer(2, 7000, false));
    gesture.move(pointer(2, 8000, false));
    gesture.up(pointer(2, 8000, false));
    gesture.cancel(pointer(2, 8000, false));
    expect(seek).not.toHaveBeenCalled();
    expect(preview).toHaveBeenCalledExactlyOnceWith(1000);
    expect(hover).toHaveBeenCalledTimes(1);
    expect(captured.has(1)).toBe(true);
    gesture.move(pointer(1, 3000));
    gesture.up(pointer(1, 4000));
    expect(seek).toHaveBeenCalledExactlyOnceWith(4000);
    expect(captured.size).toBe(0);
    dispose();
  });
});

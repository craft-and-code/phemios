import { fireEvent } from "storybook/test";

/** Model capture loss explicitly; synthetic pointers cannot acquire native browser capture. */
export function railPointer(rail: HTMLElement) {
  const band = rail.querySelector<HTMLButtonElement>(".rail-band")!;
  const track = rail.querySelector<HTMLDivElement>(".rail-track")!;
  let captured: HTMLElement | undefined;
  const restore: (() => void)[] = [];
  for (const element of [band, track]) {
    const methods = {
      setPointerCapture: () => {
        captured = element;
      },
      hasPointerCapture: () => captured === element,
      releasePointerCapture: () => {
        captured = undefined;
      },
    };
    for (const [key, value] of Object.entries(methods)) {
      const descriptor = Object.getOwnPropertyDescriptor(element, key);
      Object.defineProperty(element, key, { configurable: true, value });
      restore.push(() => {
        if (descriptor) Object.defineProperty(element, key, descriptor);
        else Reflect.deleteProperty(element, key);
      });
    }
  }
  const event = (kind: string, target: HTMLElement | Document, x: number, y: number) =>
    fireEvent(
      target,
      new PointerEvent(kind, {
        bubbles: true,
        cancelable: true,
        pointerId: 7,
        isPrimary: true,
        button: 0,
        buttons: kind === "pointerup" ? 0 : 1,
        clientX: x,
        clientY: y,
      }),
    );
  const box = band.getBoundingClientRect();
  return {
    band,
    x: box.left + box.width / 2,
    y: box.top + box.height / 2,
    width: track.getBoundingClientRect().width,
    start(x: number, y: number) {
      event("pointerdown", band, x, y);
    },
    move(x: number, y: number) {
      event("pointermove", document, x, y);
    },
    up(x: number, y: number) {
      event("pointerup", document, x, y);
    },
    lose() {
      const old = captured;
      captured = undefined;
      if (old) event("lostpointercapture", old, box.left, box.top);
    },
    restore() {
      event("pointercancel", document, box.left, box.top);
      for (const method of restore) method();
    },
  };
}

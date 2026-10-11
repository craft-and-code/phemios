import { createEffect, createRoot, createSignal, on } from "solid-js";
import { expect, it } from "vitest";
import { createCoverCatalog } from "./cover-catalog";
import { createCoverMotion } from "./cover-motion";
import { createCoverPosition } from "./cover-position";

it("keeps an active transition when recreated rows only change personal metadata", async () => {
  await createRoot(async (dispose) => {
    const [rows, setRows] = createSignal([
      { reference: "album:a", title: "Alpha", rating: 0 },
      { reference: "album:b", title: "Boreal", rating: 0 },
      { reference: "album:c", title: "Cobalt", rating: 0 },
    ]);
    const [selected, setSelected] = createSignal("album:a");
    const catalog = createCoverCatalog(rows, () => false, selected);
    const poses: number[] = [];
    let frame: ((time: number) => void) | undefined;
    const motion = createCoverMotion((pose) => poses.push(pose), {
      request: (callback) => {
        frame = callback;
        return 1;
      },
      cancel: () => {
        frame = undefined;
      },
      now: () => 0,
    });
    createEffect(on(catalog.order, () => motion.reset(catalog.index())));
    try {
      await Promise.resolve();
      setSelected("album:c");
      motion.move(catalog.index());
      frame?.(120);
      const heldPose = poses.at(-1)!;
      expect(heldPose).toBeGreaterThan(0);
      expect(heldPose).toBeLessThan(2);
      setRows(rows().map((row) => ({ ...row, rating: row.reference === "album:a" ? 4 : 0 })));
      expect(poses.at(-1)).toBe(heldPose);
      expect(frame).toBeDefined();
      frame?.(1000);
      expect(poses.at(-1)).toBe(2);
    } finally {
      motion.dispose();
      dispose();
    }
  });
});

it("retains references on append and resets only actual order, reversal or removal", async () => {
  await createRoot(async (dispose) => {
    const [rows, setRows] = createSignal([
      { reference: "album:a", title: "Alpha" },
      { reference: "album:b", title: "Boreal" },
    ]);
    const [reverse, setReverse] = createSignal(false);
    const [selected, setSelected] = createSignal("");
    const memory = createCoverPosition();
    const catalog = createCoverCatalog(rows, reverse, selected);
    const resets: string[] = [];
    createEffect(
      on(catalog.order, () => {
        setSelected(memory.restore(rows(), reverse()));
        resets.push(selected());
      }),
    );
    try {
      await Promise.resolve();
      memory.select("album:b");
      setSelected("album:b");
      expect(catalog.index()).toBe(1);
      setRows([...rows(), { reference: "album:c", title: "Cobalt" }]);
      expect(selected()).toBe("album:b");
      expect(catalog.index()).toBe(1);
      setRows([...rows()].reverse());
      setReverse(true);
      expect(selected()).toBe("album:c");
      expect(catalog.index()).toBe(0);
      setRows(rows().slice(1));
      expect(selected()).toBe("album:b");
      expect(catalog.index()).toBe(0);
      expect(resets).toEqual(["album:a", "album:b", "album:b", "album:c", "album:b"]);
      setRows([]);
      expect(selected()).toBe("");
      expect(catalog.index()).toBe(0);
    } finally {
      dispose();
    }
  });
});

it("resolves the selected position against the current result without normalizing references", () => {
  createRoot((dispose) => {
    const [rows, setRows] = createSignal([
      { reference: "album:@phemios/local/1" },
      { reference: "album:@phemios/server/1" },
    ]);
    const [selected, setSelected] = createSignal("album:@phemios/server/1");
    const catalog = createCoverCatalog(rows, () => false, selected);
    try {
      expect(catalog.index()).toBe(1);
      expect(catalog.positions().get("album:@phemios/local/1")).toBe(0);
      setRows([...rows()].reverse());
      expect(catalog.index()).toBe(0);
      setSelected("album:absent");
      expect(catalog.index()).toBe(0);
      setRows([]);
      expect(catalog.positions().size).toBe(0);
      expect(catalog.index()).toBe(0);
    } finally {
      dispose();
    }
  });
});

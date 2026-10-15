import { queueDropEdge } from "./queue-order";
import { expect, it } from "vitest";
import { originalQueueOrder, moveQueueOccurrence } from "./queue-order";
it("moves occurrences rather than references, retaining every queued track", () => {
  const order = [3, 0, 2, 1];
  expect(moveQueueOccurrence(order, 3, 2)).toEqual([0, 2, 3, 1]);
  expect(moveQueueOccurrence(order, 1, 0)).toEqual([3, 1, 0, 2]);
  expect(order).toEqual([3, 0, 2, 1]);
  expect(() => moveQueueOccurrence([0, 0], 0, 1)).toThrow();
  expect(() => moveQueueOccurrence(order, 99, 0)).toThrow();
});

it("restores initial occurrence order after title sorts, reversal and dragging", () => {
  const edited = moveQueueOccurrence([2, 0, 3, 1], 1, 2);
  expect(originalQueueOrder(edited)).toEqual([0, 1, 2, 3]);
  expect(edited).toEqual([1, 2, 0, 3]);
  expect(originalQueueOrder([])).toEqual([]);
  expect(() => originalQueueOrder([0, 0])).toThrow();
  expect(() => originalQueueOrder([0, 4096])).toThrow();
});
it("moves and restores sparse occurrence ids after removing a track", () => {
  expect(moveQueueOccurrence([0, 2, 4], 4, 0)).toEqual([4, 0, 2]);
  expect(originalQueueOrder([4, 0, 2])).toEqual([0, 2, 4]);
});

it("shows the insertion edge matching a move in edited and sparse occurrence order", () => {
  for (const order of [
    [0, 1],
    [7, 1, 4],
    [4, 7, 1],
  ]) {
    for (const from of order)
      for (const to of order) {
        const edge = queueDropEdge(order, from, to);
        if (from === to) expect(edge).toBeUndefined();
        else {
          const moved = moveQueueOccurrence(order, from, to);
          expect(edge).toBe(moved.indexOf(from) > moved.indexOf(to) ? "after" : "before");
        }
      }
  }
  expect(queueDropEdge([0, 1], undefined, 1)).toBeUndefined();
  expect(queueDropEdge([0, 1], 0, 9)).toBeUndefined();
});

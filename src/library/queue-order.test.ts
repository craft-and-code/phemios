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
  expect(() => originalQueueOrder([0, 3])).toThrow();
});

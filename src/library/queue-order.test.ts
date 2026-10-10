import { expect, it } from "vitest";
import { moveQueueOccurrence } from "./queue-order";
it("moves occurrences rather than references, retaining every queued track", () => {
  const order = [3, 0, 2, 1];
  expect(moveQueueOccurrence(order, 3, 2)).toEqual([0, 2, 3, 1]);
  expect(moveQueueOccurrence(order, 1, 0)).toEqual([3, 1, 0, 2]);
  expect(order).toEqual([3, 0, 2, 1]);
  expect(() => moveQueueOccurrence([0, 0], 0, 1)).toThrow();
  expect(() => moveQueueOccurrence(order, 99, 0)).toThrow();
});

import { t } from "../i18n";
/** Move one occurrence onto another's position; repeated track references stay distinct. */
export function moveQueueOccurrence(order: readonly number[], from: number, to: number): number[] {
  if (
    !order.length ||
    order.length > 4096 ||
    new Set(order).size !== order.length ||
    order.some((index) => !Number.isSafeInteger(index) || index < 0 || index >= order.length) ||
    !order.includes(from) ||
    !order.includes(to)
  )
    throw new Error(t("File de lecture invalide."));
  const result = [...order],
    source = result.indexOf(from),
    target = result.indexOf(to);
  result.splice(source, 1);
  result.splice(target, 0, from);
  return result;
}

/** Restore original logical occurrence indices, including repeated references and multiple albums. */
export function originalQueueOrder(order: readonly number[]): number[] {
  if (!order.length) return [];
  moveQueueOccurrence(order, order[0]!, order[0]!);
  return [...order].sort((a, b) => a - b);
}

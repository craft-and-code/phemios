/** Consumption counts only observed audible playback, using a monotonic clock within one grant. */
export function createParentalConsumption(seconds: number, carry = 0) {
  let consumed = carry,
    since: number | undefined;
  const read = () =>
    Math.min(
      seconds * 1000,
      Math.max(
        0,
        Math.floor(consumed + (since === undefined ? 0 : Math.max(0, performance.now() - since))),
      ),
    );
  return {
    read,
    playing(value: boolean) {
      consumed = read();
      since = value ? performance.now() : undefined;
    },
  };
}

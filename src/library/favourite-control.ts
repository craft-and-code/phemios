import { createMemo, createSignal, onCleanup } from "solid-js";
import { requestAede } from "../platform/desktop";
import { referenceSource } from "./sources";
import type { AccountSession, Annotation } from "./server";
/** A footer heart writes only the captured track, never the current page or a later account. */
export function createFavouriteControl(
  reference: () => string,
  session: () => AccountSession | undefined,
  loved: () => boolean,
  publish: (reference: string, annotation: Annotation | null) => void,
) {
  let alive = true;
  onCleanup(() => {
    alive = false;
  });
  const scope = createMemo(() => {
    const ref = reference(),
      account = session();
    const [busy, setBusy] = createSignal(false),
      [error, setError] = createSignal("");
    return { ref, account, busy, setBusy, error, setError };
  });
  const blocked = () =>
    !scope().ref || !scope().account || scope().account?.account.role === "auditor";
  async function toggle() {
    const held = scope();
    if (blocked() || held.busy()) return;
    held.setBusy(true);
    held.setError("");
    try {
      const answer = await requestAede<{ annotation: Annotation | null }>(
        "/api/me/v1/annotation",
        { ref: held.ref },
        "PUT",
        { loved: !loved() },
        referenceSource(held.ref),
      );
      if (alive && scope() === held) publish(held.ref, answer.annotation);
    } catch (e) {
      if (alive && scope() === held) held.setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (alive && scope() === held) held.setBusy(false);
    }
  }
  return { toggle, blocked, busy: () => scope().busy(), error: () => scope().error() };
}

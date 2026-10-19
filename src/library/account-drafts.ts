import { createEffect, on } from "solid-js";
import { createStore } from "solid-js/store";
import type { AccountSession } from "./server";
import type { SourceId } from "./sources";
const empty = () => ({
  username: "",
  password: "",
  role: "user",
  error: "",
  currentPassword: "",
  newPassword: "",
});
/** Account-management drafts remain ephemeral and never enter saved preferences. */
export function createAccountDrafts(
  session: () => AccountSession | undefined,
  source: () => SourceId,
) {
  const state = createStore(empty());
  createEffect(
    on(
      () => [session(), source()] as const,
      () => state[1](empty()),
      { defer: true },
    ),
  );
  return state;
}

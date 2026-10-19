import { createRoot, createSignal } from "solid-js";
import { afterEach, expect, it } from "vitest";
import { createAccountDrafts } from "./account-drafts";
import type { AccountSession } from "./server";
import type { SourceId } from "./sources";
let dispose: () => void;
afterEach(() => dispose?.());
const owner: AccountSession = {
  server: "https://music.example",
  account: { id: "a", username: "a", role: "admin" },
};
function setup() {
  return createRoot((end) => {
    dispose = end;
    const [session, setSession] = createSignal<AccountSession | undefined>(owner);
    const [source, setSource] = createSignal<SourceId>("server");
    const [draft, setDraft] = createAccountDrafts(session, source);
    setDraft({
      username: "draft-user",
      password: "fixture-new-account-secret",
      role: "admin",
      error: "Old account diagnostic",
      currentPassword: "fixture-current-secret",
      newPassword: "fixture-next-secret",
    });
    return { draft, setDraft, setSession, setSource };
  });
}
for (const change of ["logout", "account", "source"] as const) {
  it(`clears account-management drafts on ${change}`, () => {
    const view = setup();
    if (change === "logout") view.setSession(undefined);
    else if (change === "account")
      view.setSession({ ...owner, account: { ...owner.account, id: "b" } });
    else view.setSource("local");
    expect({ ...view.draft }).toEqual({
      username: "",
      password: "",
      role: "user",
      error: "",
      currentPassword: "",
      newPassword: "",
    });
  });
}
it("keeps edits while their session and source remain unchanged", () => {
  const view = setup();
  view.setDraft("username", "edited");
  view.setSession(owner);
  expect(view.draft.username).toBe("edited");
  expect(view.draft.password).toBe("fixture-new-account-secret");
});

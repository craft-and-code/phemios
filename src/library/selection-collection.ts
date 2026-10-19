import { createSignal } from "solid-js";
import { t } from "../i18n";
import { createPersonalActions } from "./personal-actions";
import { saveBrowsingCollection } from "./collection-save";
import type { SourceId } from "./sources";
import type { AccountSession } from "./server";
/** Own the collection dialog's private draft and deferred save feedback independently of rendering. */
export function createSelectionCollection(
  source: () => SourceId,
  session: (source: SourceId) => AccountSession | undefined,
) {
  const [draft, setDraft] = createSignal<string>(),
    [draftSource, setDraftSource] = createSignal<SourceId>(source()),
    [draftAccount, setDraftAccount] = createSignal<AccountSession>(),
    [name, setName] = createSignal(""),
    [error, setError] = createSignal(""),
    [busy, setBusy] = createSignal(false),
    [message, setMessage] = createSignal("");
  const writable = () =>
    !!session(source()) && ["user", "admin"].includes(session(source())?.account.role ?? "");
  const actions = createPersonalActions(
    () => "collections",
    () => session(source()),
    source,
    () => {
      setDraft(undefined);
      setDraftAccount(undefined);
      setName("");
      setError("");
      setBusy(false);
      setMessage("");
    },
  );
  async function save() {
    const expression = draft();
    if (!expression || busy()) return;
    const owner = draftSource(),
      account = draftAccount();
    if (!account || account !== session(owner)) {
      setError(t("Session invalide."));
      return;
    }
    const current = actions.capture(),
      savedName = name();
    setBusy(true);
    setError("");
    try {
      await saveBrowsingCollection(savedName, expression, current, owner);
      if (!current()) return;
      setDraft(undefined);
      setMessage(t("Collection « {0} » enregistrée. Elle suit ces filtres.", savedName));
    } catch (e) {
      if (current()) setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (current()) setBusy(false);
    }
  }
  return {
    draft,
    setDraft,
    draftSource,
    name,
    setName,
    error,
    setError,
    busy,
    message,
    setMessage,
    writable,
    save,
    open(expression: string) {
      setDraftSource(source());
      setDraftAccount(session(source()));
      setName("");
      setError("");
      setMessage("");
      setDraft(expression);
    },
  };
}

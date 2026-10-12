import { createSignal } from "solid-js";
import { t } from "../i18n";
import type { PreferenceBackup } from "./preference-backup";
/** Native dialogs and their review belong to the projection that requested them, including ABA changes. */
export function createPreferenceTransfer(options: {
  identity: () => object;
  read: () => string;
  export: (raw: string) => Promise<string | null>;
  import: () => Promise<string | null>;
  parse: (raw: string) => PreferenceBackup;
  apply: (value: PreferenceBackup) => void;
}) {
  const [action, setAction] = createSignal<"export" | "import">(),
    [pending, setPending] = createSignal<{ identity: object; values: PreferenceBackup }>(),
    [error, setError] = createSignal(""),
    [message, setMessage] = createSignal("");
  let alive = true,
    identity = options.identity();
  function changed() {
    const next = options.identity();
    if (next === identity) return;
    identity = next;
    setPending(undefined);
    setError("");
    setMessage("");
  }
  async function run(exporting: boolean) {
    if (!alive || action()) return;
    const held = options.identity(),
      current = () => alive && options.identity() === held;
    setAction(exporting ? "export" : "import");
    setPending(undefined);
    setError("");
    setMessage("");
    try {
      if (exporting) {
        const path = await options.export(options.read());
        if (path && current()) setMessage(t("Préférences enregistrées : {0}", path));
      } else {
        const raw = await options.import();
        if (raw !== null && current()) setPending({ identity: held, values: options.parse(raw) });
      }
    } catch (failure) {
      if (current()) setError(String(failure));
    } finally {
      if (alive) setAction(undefined);
    }
  }
  return {
    action,
    pending: () => pending()?.values,
    error,
    message,
    run,
    changed,
    clearPending: () => setPending(undefined),
    clearError: () => setError(""),
    clearMessage: () => setMessage(""),
    apply() {
      const held = pending();
      if (!alive || !held) return;
      if (held.identity !== options.identity()) {
        changed();
        return;
      }
      try {
        options.apply(held.values);
        setPending(undefined);
        setMessage(t("Préférences importées."));
        setError("");
      } catch (failure) {
        setError(String(failure));
      }
    },
    dispose() {
      alive = false;
    },
  };
}

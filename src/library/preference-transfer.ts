import { createSignal } from "solid-js";
import { t } from "../i18n";
/** Native dialogs and their review belong to the projection that requested them, including ABA changes. */
export function createPreferenceTransfer<T>(options: {
  identity: () => object;
  read: () => string | Promise<string>;
  export: (raw: string) => Promise<string | null>;
  import: () => Promise<string | null>;
  parse: (raw: string) => T;
  apply: (value: T) => void | Promise<void>;
}) {
  const [action, setAction] = createSignal<"export" | "import" | "restore">(),
    [pending, setPending] = createSignal<{ identity: object; values: T }>(),
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
        const document = await options.read();
        if (!current()) return;
        const path = await options.export(document);
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
    pending: () => {
      const held = pending();
      return alive && held?.identity === options.identity() ? held?.values : undefined;
    },
    error,
    message,
    run,
    changed,
    clearPending: () => setPending(undefined),
    clearError: () => setError(""),
    clearMessage: () => setMessage(""),
    async apply() {
      const held = pending();
      if (!alive || !held || action()) return;
      if (held.identity !== options.identity()) {
        changed();
        return;
      }
      const current = () => alive && options.identity() === held.identity;
      setAction("restore");
      try {
        await options.apply(held.values);
        if (!current()) return;
        setPending(undefined);
        setMessage(t("Préférences importées."));
        setError("");
      } catch (failure) {
        if (current()) setError(String(failure));
      } finally {
        if (alive) setAction(undefined);
      }
    },
    dispose() {
      alive = false;
    },
  };
}

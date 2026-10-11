import { t } from "../i18n";
type Store = Pick<Storage, "getItem" | "setItem" | "removeItem">;
/** Persist a validated preference projection together; failed writes restore the captured bytes.
 * Callers own key/value admission. Unrelated personal stores are never touched. Browser storage
 * is synchronous, so this is rollback protection, not a transaction across other processes.
 */
export function writePreferenceEntries(storage: Store, values: Record<string, unknown>): void {
  const entries = Object.entries(values).map(
      ([key, value]) => [key, JSON.stringify(value)] as const,
    ),
    previous = entries.map(([key]) => [key, storage.getItem(key)] as const);
  try {
    for (const [key, raw] of entries) storage.setItem(key, raw);
  } catch (failure) {
    let restored = true;
    for (const [key, raw] of previous.reverse()) {
      try {
        if (raw === null) storage.removeItem(key);
        else storage.setItem(key, raw);
      } catch {
        restored = false;
      }
    }
    if (!restored)
      throw new Error(
        t("Enregistrement interrompu ; la restauration des réglages précédents a échoué."),
      );
    throw failure;
  }
}

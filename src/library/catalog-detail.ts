import type { AccountSession } from "./server";
import { createDiagnosticRead, type ReadAdmission } from "./diagnostic-read";
/** Detail facts and errors belong to one reference/login generation, including logout and re-login. */
export function createCatalogDetail<Value>(
  reference: () => string | false | null | undefined,
  session: () => AccountSession | undefined,
  read: (reference: string, session: AccountSession, admission: ReadAdmission) => Promise<Value>,
) {
  return createDiagnosticRead(
    () => {
      const ref = reference(),
        owner = session();
      return ref && owner ? { reference: ref, owner } : false;
    },
    (key, admission) => read(key.reference, key.owner, admission),
  );
}

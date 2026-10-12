import { createEffect } from "solid-js";
import { t } from "../i18n";
import type { AccountSession } from "./server";
import type { SourceId } from "./sources";
import { createPreferenceTransfer } from "./preference-transfer";
import {
  exportApplicationBackup,
  parseApplicationBackup,
  type PersonalBackup,
} from "./application-backup";
import { applyPreferenceBackup, type PreferenceBackup } from "./preference-backup";
type StoragePort = Pick<Storage, "getItem" | "setItem" | "removeItem">;
interface Options {
  identity: () => object;
  session: () => AccountSession | undefined;
  source: () => SourceId;
  storage: StoragePort;
  readPersonal: (source: SourceId, owner: AccountSession) => Promise<unknown>;
  restorePersonal: (
    payload: PersonalBackup,
    source: SourceId,
    owner: AccountSession,
  ) => Promise<void>;
  export: (raw: string, source?: SourceId, owner?: AccountSession) => Promise<string | null>;
  import: () => Promise<string | null>;
  preferencesApplied: (values: PreferenceBackup) => void;
  personalRestored: () => void;
}
/** Retain both projection generation and exact native account across private reads/dialogs/restore. */
export function createApplicationBackupTransfer(options: Options) {
  let scope: { profile: object; owner: AccountSession | undefined; source: SourceId } | undefined;
  function identity() {
    const profile = options.identity(),
      owner = options.session(),
      source = options.source();
    if (!scope || scope.profile !== profile || scope.owner !== owner || scope.source !== source)
      scope = { profile, owner, source };
    return scope;
  }
  function capture() {
    const held = identity();
    return { owner: held.owner, source: held.source, current: () => identity() === held };
  }
  function admit(held: ReturnType<typeof capture>) {
    if (!held.current()) throw new Error(t("Session remplacée ou déconnectée. Reconnectez-vous."));
  }
  let exportScope: ReturnType<typeof capture> | undefined;
  const transfer = createPreferenceTransfer({
    identity,
    async read() {
      const held = capture();
      const personal = held.owner ? await options.readPersonal(held.source, held.owner) : undefined;
      admit(held);
      const document = exportApplicationBackup(options.storage, personal);
      exportScope = held;
      return document;
    },
    async export(raw) {
      const held = exportScope;
      exportScope = undefined;
      if (!held) throw new Error(t("Sauvegarde des préférences invalide."));
      admit(held);
      return options.export(raw, held.owner ? held.source : undefined, held.owner);
    },
    import: options.import,
    parse: parseApplicationBackup,
    async apply(backup) {
      const held = capture();
      if (backup.personal) {
        if (!held.owner)
          throw new Error(
            t("Connectez-vous pour restaurer les podcasts et articles dans votre compte."),
          );
        if (!["user", "admin"].includes(held.owner.account.role))
          throw new Error(t("Ce compte ne peut pas modifier ses données personnelles."));
        await options.restorePersonal(backup.personal, held.source, held.owner);
        admit(held);
        options.personalRestored();
      }
      admit(held);
      const values = applyPreferenceBackup(options.storage, backup.values);
      options.preferencesApplied(values);
    },
  });
  createEffect(() => transfer.changed());
  return transfer;
}

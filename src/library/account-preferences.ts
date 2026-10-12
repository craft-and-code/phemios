import { accountSettingKeys } from "./account-preference-keys";
import type { AccountSession } from "./server";
import type { SourceId } from "./sources";
import { t } from "../i18n";
type Store = Pick<Storage, "getItem" | "setItem">;
type Projection = Record<string, unknown>;
type Validate = (values: Projection) => Projection;
const prefix = "phemios.interface-profile.v1:";
function checked(value: unknown): Projection {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.keys(value).some((key) => !accountSettingKeys.some((known) => known === key))
  )
    throw new Error(t("Préférences de compte invalides."));
  for (const entry of Object.values(value)) {
    const raw = JSON.stringify(entry);
    if (raw === undefined || raw.length > 8192)
      throw new Error(t("Préférences de compte invalides."));
  }
  return value as Projection;
}
/** The managed-local authority survives its ephemeral port; remote authorities remain distinct. */
export function accountPreferenceOwner(
  session: AccountSession | undefined,
  source: SourceId,
): string | undefined {
  return session
    ? JSON.stringify([
        source,
        source === "local" ? "phemios-managed-local" : session.server,
        session.account.id,
      ])
    : undefined;
}
/** Profiles occupy new keys; legacy global settings are neither read nor attributed implicitly.
 * Switching clears the projection before validating a stored profile. Invalid bytes remain intact
 * and block writes while their visible projection stays neutral. Anonymous choices use a separate
 * device profile. One JSON write precedes publication, so quota failure cannot acknowledge half a profile.
 */
export function createAccountPreferenceProfiles(backing: Store) {
  let owner: string | undefined,
    values: Projection = {},
    blocked: unknown;
  let identity: { owner: string | undefined } = { owner: undefined };
  const key = () => prefix + encodeURIComponent(owner ?? "device");
  function commit(next: Projection) {
    if (blocked) throw blocked;
    const checkedValues = checked(next);
    backing.setItem(key(), JSON.stringify({ version: 1, values: checkedValues }));
    values = checkedValues;
  }
  function activate(nextOwner: string | undefined, validate: Validate = checked) {
    owner = nextOwner;
    identity = { owner };
    values = {};
    blocked = undefined;
    try {
      const raw = backing.getItem(key());
      if (raw === null) return;
      if (raw.length > 131072) throw new Error(t("Préférences de compte invalides."));
      const row = JSON.parse(raw);
      if (
        !row ||
        row.version !== 1 ||
        Object.keys(row).some((key) => !["version", "values"].includes(key))
      )
        throw new Error(t("Préférences de compte invalides."));
      values = validate(checked(row.values));
    } catch (failure) {
      blocked = failure;
      throw failure;
    }
  }
  try {
    activate(undefined);
  } catch {
    /* The synchronizer surfaces this error when mounted. */
  }
  const storage = {
    getItem(name: string): string | null {
      return Object.hasOwn(values, name) ? JSON.stringify(values[name]) : null;
    },
    setItem(name: string, raw: string) {
      commit({ ...values, [name]: JSON.parse(raw) });
    },
    removeItem(name: string) {
      const next = { ...values };
      delete next[name];
      commit(next);
    },
  };
  return {
    storage,
    activate,
    owner: () => owner,
    identity: () => identity,
    replace(expected: object, next: Projection) {
      if (expected !== identity) return false;
      commit(next);
      return true;
    },
  };
}
const profiles = new WeakMap<Store, ReturnType<typeof createAccountPreferenceProfiles>>();
function current() {
  let value = profiles.get(localStorage);
  if (!value) {
    value = createAccountPreferenceProfiles(localStorage);
    profiles.set(localStorage, value);
  }
  return value;
}
/** Readers and writers use the active interface projection, never the preceding owner's legacy keys. */
export const interfacePreferences = {
  getItem: (key: string) => current().storage.getItem(key),
  setItem: (key: string, raw: string) => current().storage.setItem(key, raw),
  removeItem: (key: string) => current().storage.removeItem(key),
};
/** Synchronous owner switching must precede both rendering refresh and asynchronous account reads. */
export function activateInterfaceProfile(owner: string | undefined, validate: Validate) {
  current().activate(owner, validate);
}
/** A captured generation can replace only its current projection; missing keys return to defaults. */
export function replaceInterfaceProfile(identity: object, values: Projection) {
  return current().replace(identity, values);
}
/** Announcements capture the profile that performed the acknowledged local write. */
export const interfaceProfileOwner = () => current().owner();

/** Full projection identity changes even for Alice → Bob → Alice and replaced same-account sessions. */
export const interfaceProfileIdentity = () => current().identity();

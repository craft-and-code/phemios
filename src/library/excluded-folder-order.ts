import { accountPreferenceOwner } from "./account-preferences";
import type { AccountSession } from "./server";
import { t } from "../i18n";
type Store = Pick<Storage, "getItem" | "setItem">;
async function fingerprint(value: string) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
/** Device-only presentation order stores fingerprints, never paths or engine exclusion rules. */
export function createExcludedFolderOrder(storage: Store) {
  const key = async (owner: AccountSession) =>
    "phemios.exclusion-order.v1:" + (await fingerprint(accountPreferenceOwner(owner, "local")!));
  function read(name: string): string[] {
    const raw = storage.getItem(name);
    if (raw === null) return [];
    if (raw.length > 300000) throw new Error(t("Ordre des exclusions illisible."));
    const row = JSON.parse(raw);
    if (
      !row ||
      row.version !== 1 ||
      !Array.isArray(row.order) ||
      row.order.length > 4096 ||
      row.order.some((id: unknown) => typeof id !== "string" || !/^[0-9a-f]{64}$/.test(id)) ||
      new Set(row.order).size !== row.order.length ||
      Object.keys(row).some((field) => !["version", "order"].includes(field))
    )
      throw new Error(t("Ordre des exclusions illisible."));
    return row.order;
  }
  return {
    async read(owner: AccountSession, paths: string[]) {
      const order = read(await key(owner));
      const rows = await Promise.all(
        paths.map(async (path) => ({ path, id: await fingerprint(path) })),
      );
      const rank = new Map(order.map((id, index) => [id, index]));
      return rows
        .sort((a, b) => (rank.get(a.id) ?? order.length) - (rank.get(b.id) ?? order.length))
        .map((row) => row.path);
    },
    async save(owner: AccountSession, paths: string[], current: () => boolean) {
      const name = await key(owner),
        order = await Promise.all(paths.map(fingerprint));
      if (!current()) return;
      read(name);
      if (order.length > 4096 || new Set(order).size !== order.length)
        throw new Error(t("Ordre des exclusions illisible."));
      storage.setItem(name, JSON.stringify({ version: 1, order }));
    },
  };
}

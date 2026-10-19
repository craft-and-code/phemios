import { createResource } from "solid-js";
import { t } from "../i18n";
import { requestAede } from "../platform/desktop";
import type { AccountSession } from "./server";
import type { SourceId } from "./sources";
export interface Account {
  id: string;
  username: string;
  role: "admin" | "user" | "auditor";
  enabled: boolean;
  parental_locked_by?: string;
}
/** Only the application-owned local principal is protected by client-side account controls. */
export function managedLocalAccount(account: Pick<Account, "username">, source: SourceId): boolean {
  return source === "local" && account.username.toLowerCase() === "phemios-local";
}
export function parseAccounts(raw: unknown): Account[] {
  if (
    !Array.isArray(raw) ||
    raw.length > 10000 ||
    raw.some(
      (row) =>
        !row ||
        typeof row.id !== "string" ||
        !row.id ||
        typeof row.username !== "string" ||
        !row.username ||
        !["admin", "user", "auditor"].includes(row.role) ||
        typeof row.enabled !== "boolean" ||
        (row.parental_locked_by !== undefined &&
          (typeof row.parental_locked_by !== "string" ||
            !row.parental_locked_by ||
            row.parental_locked_by.length > 256)),
    ) ||
    new Set(raw.map((row) => row.id)).size !== raw.length
  )
    throw new Error(t("Liste des comptes Aède invalide."));
  return raw as Account[];
}
/** Read only the captured administrator, retaining read errors inside the optional settings tab. */
export function createAccountList(
  session: () => AccountSession | undefined,
  source: () => SourceId,
) {
  const [rows, { refetch }] = createResource(
    () => (session()?.account.role === "admin" ? { session: session()!, source: source() } : false),
    async (key) => {
      try {
        return {
          ...key,
          values: parseAccounts(
            await requestAede("/api/admin/v1/accounts", {}, "GET", null, key.source),
          ),
          error: "",
        };
      } catch (failure) {
        return { ...key, values: [] as Account[], error: String(failure) };
      }
    },
  );
  const current = () => {
    const value = rows();
    return value && value.session === session() && value.source === source() ? value : undefined;
  };
  return {
    values: () => current()?.values ?? [],
    error: () => current()?.error ?? "",
    loading: () => rows.loading,
    refresh: refetch,
  };
}

import { t } from "../i18n";
import type { AccountSession } from "./server";

/** Validate the retained named principal without adopting a successor or inventing a legacy policy. */
export function liveParentalCapability(raw: unknown, owner: AccountSession): boolean {
  const account = raw as Record<string, unknown> | null;
  if (
    !account ||
    typeof account !== "object" ||
    Array.isArray(account) ||
    !owner.account.id ||
    account.id !== owner.account.id ||
    account.enabled !== true ||
    !["admin", "user", "auditor"].includes(owner.account.role) ||
    account.role !== owner.account.role
  )
    throw Error(t("Session remplacée ou déconnectée. Reconnectez-vous."));
  if (
    (account.parental_enabled !== undefined && typeof account.parental_enabled !== "boolean") ||
    (typeof owner.account.parental_enabled === "boolean" &&
      typeof account.parental_enabled !== "boolean")
  )
    throw Error(t("Contrôle parental Aède invalide."));
  return account.role !== "admin" && typeof account.parental_enabled === "boolean";
}

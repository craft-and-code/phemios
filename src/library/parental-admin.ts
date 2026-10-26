import { batch, createEffect, createMemo, createSignal, onCleanup } from "solid-js";
import { t } from "../i18n";
import { requestAede } from "../platform/desktop";
import type { Account } from "./account-list";
import type { AccountSession } from "./server";
import type { SourceId } from "./sources";
import {
  parseParentalPolicy,
  parentalPolicyStamp,
  parseParentalPolicySnapshot,
  type ParentalPolicy,
} from "./parental-controls";
/** Administration has a captured source, administrator generation and immutable target identity. */
export interface ParentalAdminScope {
  source: SourceId;
  session: AccountSession;
  target: Account;
}
export function parentalAdministrative(session: AccountSession | undefined): boolean {
  return session?.account.role === "admin";
}
type Request = typeof requestAede;
/** Explicit policy writes retain their draft on conflicts; no child-editable preference store is involved. */
export function createParentalAdmin(
  input: () => ParentalAdminScope | undefined,
  request: Request = requestAede,
) {
  const scope = createMemo(input),
    [draft, setDraft] = createSignal<ParentalPolicy>(),
    [confirmed, setConfirmed] = createSignal<{
      revision: number;
      policy: ParentalPolicy;
      locked_by?: string | null;
    }>(),
    [loading, setLoading] = createSignal(false),
    [saving, setSaving] = createSignal(false),
    [error, setError] = createSignal(""),
    [message, setMessage] = createSignal("");
  let alive = true,
    revision = 0;
  const valid = (held: ParentalAdminScope | undefined) =>
    !!held && parentalAdministrative(held.session) && held.target.role !== "admin";
  const current = (held: ParentalAdminScope, ticket: number) =>
    alive && scope() === held && revision === ticket;
  const path = (held: ParentalAdminScope) =>
    `/api/admin/v1/accounts/${encodeURIComponent(held.target.username)}/parental`;
  async function load() {
    const held = scope(),
      ticket = ++revision;
    batch(() => {
      setDraft(undefined);
      setConfirmed(undefined);
      setError("");
      setMessage("");
      setSaving(false);
      setLoading(valid(held));
    });
    if (!valid(held) || !held) return;
    try {
      const value = parseParentalPolicySnapshot(
        await request(path(held), {}, "GET", null, held.source, held.session),
        held.target.id,
      );
      if (current(held, ticket))
        batch(() => {
          setConfirmed(value);
          setDraft(parseParentalPolicy(value.policy));
        });
    } catch (failure) {
      if (current(held, ticket)) setError(String(failure));
    } finally {
      if (current(held, ticket)) setLoading(false);
    }
  }
  createEffect(() => {
    scope();
    void load();
  });
  onCleanup(() => {
    alive = false;
    revision++;
  });
  const dirty = createMemo(
    () => !!draft() && parentalPolicyStamp(draft()) !== parentalPolicyStamp(confirmed()?.policy),
  );
  const locked = () =>
    !!confirmed()?.locked_by && confirmed()?.locked_by !== scope()?.session.account.id;
  async function save() {
    const held = scope(),
      policy = draft(),
      saved = confirmed(),
      ticket = revision;
    if (!held || !valid(held) || !policy || !saved || saving() || loading() || !dirty() || locked())
      return false;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const checked = parseParentalPolicy(policy);
      const value = parseParentalPolicySnapshot(
        await request(
          path(held),
          {},
          "PUT",
          { expected_owner: held.target.id, expected_revision: saved.revision, policy: checked },
          held.source,
          held.session,
        ),
        held.target.id,
      );
      if (!current(held, ticket)) return false;
      if (value.revision <= saved.revision)
        throw Error(t("La politique a changé. Rechargez-la avant de réessayer."));
      batch(() => {
        setConfirmed(value);
        setDraft(parseParentalPolicy(value.policy));
        setMessage(t("Contrôle parental enregistré."));
      });
      return true;
    } catch (failure) {
      if (current(held, ticket)) setError(String(failure));
      return false;
    } finally {
      if (current(held, ticket)) setSaving(false);
    }
  }
  return {
    draft: () => (alive && valid(scope()) ? draft() : undefined),
    loading,
    saving,
    locked,
    error,
    message,
    dirty,
    update(next: ParentalPolicy) {
      if (!saving() && !locked() && valid(scope()) && draft()) {
        setDraft(next);
        setError("");
        setMessage("");
      }
    },
    reset() {
      if (!saving() && confirmed()) {
        setDraft(parseParentalPolicy(confirmed()!.policy));
        setError("");
        setMessage("");
      }
    },
    load,
    cancelLoad() {
      if (loading()) {
        revision++;
        setLoading(false);
      }
    },
    save,
    dismiss: () => setMessage(""),
  };
}

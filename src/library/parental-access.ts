import { createEffect, createMemo, createSignal, onCleanup, untrack } from "solid-js";
import { t } from "../i18n";
import { requestAede } from "../platform/desktop";
import {
  parseParentalStatus,
  parentalPolicyStamp,
  type ParentalStatus,
  type ParentalReason,
} from "./parental-controls";
import type { AccountSession, Snapshot } from "./server";
import { liveParentalCapability } from "./parental-account";
import type { SourceId } from "./sources";
export type ExternalParentalMedia = { kind: "radio" } | { kind: "podcast"; feed: string };
export function parentalMessage(reason: ParentalReason | null): string {
  return t(
    {
      outside_schedule: "Cette plage horaire n’autorise pas l’écoute.",
      daily_limit: "La durée d’écoute maximale du jour est atteinte.",
      weekly_limit: "La durée d’écoute maximale de la semaine est atteinte.",
      radio_blocked: "L’accès aux radios est interdit pour ce compte.",
      podcast_blocked: "L’accès à ce podcast est interdit pour ce compte.",
      artist_blocked: "Cet artiste est masqué pour ce compte.",
      policy_unavailable: "Le contrôle parental ne peut pas être vérifié. Reconnectez Aède.",
    }[reason ?? "policy_unavailable"],
  );
}
/** Policy reads belong to an exact session; private drafts and public snapshots are never an authority. */
export function createParentalAccess(input: {
  session: (source: SourceId) => AccountSession | undefined;
  source: () => SourceId;
  changed: (source: SourceId, status: ParentalStatus) => void;
  unavailable: (source: SourceId) => void;
  request?: typeof requestAede;
}) {
  const request = input.request ?? requestAede;
  const [records, setRecords] = createSignal<
    Partial<Record<SourceId, { owner: AccountSession; value?: ParentalStatus; error?: string }>>
  >({});
  let alive = true;
  const supported = (owner: AccountSession | undefined) =>
    owner?.account.role !== "admin" && typeof owner?.account.parental_enabled === "boolean";
  const record = (source: SourceId) => {
    const row = records()[source];
    return row?.owner === input.session(source) ? row : undefined;
  };
  // Playback counters refresh often; catalogue admission depends only on the policy/owner/error.
  const policyRecord = Object.fromEntries(
    (["local", "server"] as const).map((source) => [
      source,
      createMemo(() => record(source), undefined, {
        equals: (previous, next) =>
          previous?.owner === next?.owner &&
          previous?.error === next?.error &&
          previous?.value?.revision === next?.value?.revision &&
          parentalPolicyStamp(previous?.value?.policy) === parentalPolicyStamp(next?.value?.policy),
      }),
    ]),
  ) as Record<SourceId, () => ReturnType<typeof record>>;
  const pending = new Map<
    SourceId,
    { owner: AccountSession; promise: Promise<ParentalStatus | undefined> }
  >();
  function refresh(
    source: SourceId,
    owner = input.session(source),
  ): Promise<ParentalStatus | undefined> {
    if (!owner) return Promise.resolve(undefined);
    const held = pending.get(source);
    if (held?.owner === owner) return held.promise;
    const promise = read(source, owner).finally(() => {
      if (pending.get(source)?.promise === promise) pending.delete(source);
    });
    pending.set(source, { owner, promise });
    return promise;
  }
  async function read(source: SourceId, owner: AccountSession) {
    const current = () => {
      if (!alive || input.session(source) !== owner)
        throw Error(t("Session remplacée ou déconnectée. Reconnectez-vous."));
    };
    try {
      current();
      const needsPolicy =
        supported(owner) ||
        liveParentalCapability(
          await request("/api/auth/v1/session", {}, "GET", null, source, owner),
          owner,
        );
      current();
      const value = needsPolicy
        ? parseParentalStatus(await request("/api/me/v1/parental", {}, "GET", null, source, owner))
        : undefined;
      current();
      if (value && value.owner !== owner.account.id)
        throw Error(t("Contrôle parental Aède invalide."));
      const priorRecord = untrack(() => record(source)),
        prior = priorRecord?.value;
      setRecords((previous) => ({ ...previous, [source]: { owner, ...(value ? { value } : {}) } }));
      if (
        value &&
        (priorRecord?.error ||
          (value.policy.enabled &&
            (!prior ||
              prior.revision !== value.revision ||
              parentalPolicyStamp(prior.policy) !== parentalPolicyStamp(value.policy))) ||
          (prior?.policy.enabled &&
            (prior.revision !== value.revision ||
              parentalPolicyStamp(prior.policy) !== parentalPolicyStamp(value.policy))))
      )
        untrack(() => input.changed(source, value));
      return value;
    } catch (failure) {
      if (alive && input.session(source) === owner) {
        setRecords((previous) => ({
          ...previous,
          [source]: {
            owner,
            ...(previous[source]?.owner === owner && previous[source]?.value
              ? { value: previous[source]!.value }
              : {}),
            error: String(failure),
          },
        }));
        untrack(() => input.unavailable(source));
      }
      throw failure;
    }
  }
  for (const source of ["local", "server"] as const)
    createEffect(() => {
      const owner = input.session(source);
      let timer: ReturnType<typeof setTimeout> | undefined,
        current = true;
      const poll = async () => {
        try {
          await refresh(source, owner);
        } catch {
          /* Visible state retains the failure; the next bounded poll retries. */
        }
        if (current && alive) timer = setTimeout(() => void poll(), 5000);
      };
      if (owner) void poll();
      onCleanup(() => {
        current = false;
        clearTimeout(timer);
      });
    });
  onCleanup(() => {
    alive = false;
  });
  const status = (source = input.source()) => record(source)?.value;
  const available = (source = input.source()) =>
    !input.session(source) || (!!policyRecord[source]() && !policyRecord[source]()?.error);
  const radioAllowed = () =>
    available() &&
    !(
      policyRecord[input.source()]()?.value?.policy.enabled &&
      !policyRecord[input.source()]()?.value?.policy.radio_allowed
    );
  const podcastsAllowed = () =>
    available() &&
    !(
      policyRecord[input.source()]()?.value?.policy.enabled &&
      !policyRecord[input.source()]()?.value?.policy.podcasts_allowed
    );
  const permitsPodcast = (policy: ParentalStatus["policy"] | undefined, feed: string) => {
    if (!policy?.enabled) return true;
    if (!policy.podcasts_allowed) return false;
    const canonical = (value: string) => {
      try {
        const url = new URL(value);
        url.hash = "";
        return url.href;
      } catch {
        return value;
      }
    };
    return !policy.blocked_podcasts.some((value) => canonical(value) === canonical(feed));
  };
  const podcastAllowed = (feed: string) => {
    if (!available()) return false;
    return permitsPodcast(policyRecord[input.source()]()?.value?.policy, feed);
  };
  const viewScope = createMemo(() =>
    JSON.stringify(
      (["local", "server"] as const).map((source) => {
        const owner = input.session(source),
          row = policyRecord[source]();
        return [
          source,
          owner?.nativeSession,
          owner?.server,
          owner?.account.id,
          owner?.account.role,
          row?.value?.revision,
          parentalPolicyStamp(row?.value?.policy),
          available(source),
          row?.error,
        ];
      }),
    ),
  );
  return {
    viewScope,
    status,
    refresh,
    available,
    radioAllowed,
    podcastAllowed,
    podcastsAllowed,
    supported: (source = input.source()) => supported(input.session(source)) || !!status(source),
    error: () => record(input.source())?.error ?? "",
    catalogVisible(source: SourceId, snapshot: Snapshot | undefined) {
      const owner = input.session(source),
        row = policyRecord[source]();
      if (!supported(owner) && !row?.value) return true;
      if (!row?.value || row.error) return false;
      return (
        !row.value.policy.enabled ||
        (!!snapshot &&
          snapshot.parentalEnabled === true &&
          snapshot.accountId === owner?.account.id &&
          snapshot.parentalRevision === row.value.revision &&
          parentalPolicyStamp(snapshot.parentalPolicy) === parentalPolicyStamp(row.value.policy))
      );
    },
    async check(
      media: ExternalParentalMedia,
      source = input.source(),
      owner = input.session(source),
    ) {
      if (!owner) return undefined;
      const value = await refresh(source, owner);
      if (!value) return undefined;
      if (!value.policy.enabled) return undefined;
      if (!value.allowed) throw Error(parentalMessage(value.reason));
      if (media.kind === "radio" && !value.policy.radio_allowed)
        throw Error(parentalMessage("radio_blocked"));
      if (media.kind === "podcast" && !permitsPodcast(value.policy, media.feed))
        throw Error(parentalMessage("podcast_blocked"));
      return { source, owner, status: value };
    },
  };
}

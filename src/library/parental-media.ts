import { createParentalConsumption } from "./parental-media-clock";
import { createEffect, onCleanup } from "solid-js";
import { t } from "../i18n";
import { requestAede } from "../platform/desktop";
import type { ExternalParentalMedia } from "./parental-access";
import type { ParentalStatus } from "./parental-controls";
import type { AccountSession } from "./server";
import type { SourceId } from "./sources";
type Admission = { source: SourceId; owner: AccountSession; status: ParentalStatus };
type Grant = {
  lease_id: string;
  expires_at: number;
  server_now_ms: number;
  granted_seconds: number;
};
function grant(raw: unknown): Grant {
  const row = raw as Grant;
  if (
    !row ||
    typeof row.lease_id !== "string" ||
    !row.lease_id ||
    row.lease_id.length > 256 ||
    !Number.isSafeInteger(row.expires_at) ||
    row.expires_at < 0 ||
    !Number.isSafeInteger(row.expires_at * 1000) ||
    !Number.isSafeInteger(row.server_now_ms) ||
    row.server_now_ms < 0 ||
    !Number.isSafeInteger(row.granted_seconds) ||
    row.granted_seconds <= 0 ||
    row.granted_seconds > 10
  )
    throw Error(t("Autorisation d’écoute Aède invalide."));
  return {
    lease_id: row.lease_id,
    expires_at: row.expires_at,
    server_now_ms: row.server_now_ms,
    granted_seconds: row.granted_seconds,
  };
}
/** External media reserve short server-owned listening leases; a separate deadline stops audio even if renewal hangs. */
export function createParentalMedia(input: {
  access: {
    check: (
      media: ExternalParentalMedia,
      source?: SourceId,
      owner?: AccountSession,
    ) => Promise<Admission | undefined>;
  };
  source: () => SourceId;
  session: (source: SourceId) => AccountSession | undefined;
  request?: typeof requestAede;
  stop: () => void;
  error: (message: string) => void;
}) {
  const request = input.request ?? requestAede,
    path = "/api/me/v1/parental/lease";
  let alive = true,
    generation = 0,
    status = "idle",
    expiration: ReturnType<typeof setTimeout> | undefined,
    renewal: ReturnType<typeof setTimeout> | undefined,
    captured: { source: SourceId; owner: AccountSession | undefined; ticket: number } | undefined,
    lease:
      | {
          scope: Admission;
          grant: Grant;
          deadline: number;
          consumption: ReturnType<typeof createParentalConsumption>;
          renewing: boolean;
        }
      | undefined;
  function release(scope: Admission, leaseId: string, consumedMs = 0) {
    void request(
      path,
      {},
      "POST",
      { action: "release", lease_id: leaseId, consumed_ms: consumedMs },
      scope.source,
      scope.owner,
    ).catch(() => {});
  }
  function stop() {
    generation++;
    status = "idle";
    captured = undefined;
    clearTimeout(expiration);
    clearTimeout(renewal);
    expiration = undefined;
    renewal = undefined;
    const held = lease;
    lease = undefined;
    if (held) {
      held.consumption.playing(false);
      if (!held.renewing) release(held.scope, held.grant.lease_id, held.consumption.read());
    }
  }
  const current = (held: NonNullable<typeof captured>) =>
    alive &&
    captured === held &&
    held.ticket === generation &&
    input.session(held.source) === held.owner;
  function fail(message: string) {
    stop();
    input.stop();
    input.error(message);
  }
  function accept(scope: Admission, value: Grant, requestedAt: number, carry = 0) {
    // Use only the server clock delta, then subtract the full request round trip monotonically.
    const deadline =
      requestedAt +
      Math.min(value.granted_seconds * 1000, value.expires_at * 1000 - value.server_now_ms);
    const milliseconds = deadline - performance.now();
    if (milliseconds <= 0) throw Error(t("L’autorisation d’écoute a expiré."));
    const consumption = createParentalConsumption(value.granted_seconds, carry);
    consumption.playing(status === "playing");
    lease = {
      scope,
      grant: value,
      deadline,
      consumption,
      renewing: false,
    };
    clearTimeout(expiration);
    expiration = setTimeout(() => fail(t("L’autorisation d’écoute a expiré.")), milliseconds);
  }
  function schedule() {
    clearTimeout(renewal);
    renewal = undefined;
    const held = captured,
      retained = lease;
    if (!held || !retained || status !== "playing") return;
    const delay = Math.min(
      8000,
      retained.grant.granted_seconds * 500,
      retained.deadline - performance.now(),
    );
    renewal = setTimeout(() => void renew(held, retained), Math.max(1, delay));
  }
  async function renew(held: NonNullable<typeof captured>, retained: NonNullable<typeof lease>) {
    renewal = undefined;
    if (!current(held) || lease !== retained || status !== "playing") return;
    const reported = retained.consumption.read(),
      requestedAt = performance.now();
    retained.renewing = true;
    try {
      const value = grant(
        await request(
          path,
          {},
          "POST",
          {
            action: "renew",
            lease_id: retained.grant.lease_id,
            consumed_ms: reported,
            seconds: 10,
          },
          retained.scope.source,
          retained.scope.owner,
        ),
      );
      const carry = Math.max(0, retained.consumption.read() - reported);
      if (!current(held) || lease !== retained) {
        release(retained.scope, value.lease_id, Math.min(value.granted_seconds * 1000, carry));
        return;
      }
      if (value.lease_id !== retained.grant.lease_id) {
        release(retained.scope, value.lease_id);
        throw Error(t("Autorisation d’écoute Aède invalide."));
      }
      accept(retained.scope, value, requestedAt, carry);
      schedule();
    } catch (failure) {
      retained.renewing = false;
      if (current(held) && lease === retained)
        fail(failure instanceof Error ? failure.message : t("L’autorisation d’écoute a expiré."));
      else release(retained.scope, retained.grant.lease_id, retained.consumption.read());
    }
  }
  /** Bind the initiating source and optional login before delayed preparation without reserving listening time. */
  function capture() {
    stop();
    const source = input.source(),
      held = { source, owner: input.session(source), ticket: generation };
    captured = held;
    return (media: ExternalParentalMedia) => authorize(media, held);
  }
  async function authorize(media: ExternalParentalMedia, held: NonNullable<typeof captured>) {
    if (!current(held)) throw Error(t("Session remplacée ou déconnectée. Reconnectez-vous."));
    const scope = await input.access.check(media, held.source, held.owner);
    if (!current(held)) throw Error(t("Session remplacée ou déconnectée. Reconnectez-vous."));
    if (!scope) return;
    if (scope.owner !== held.owner || scope.source !== held.source)
      throw Error(t("Contrôle parental Aède invalide."));
    const requestedAt = performance.now();
    const value = grant(
      await request(
        path,
        {},
        "POST",
        { action: "reserve", media, seconds: 10 },
        scope.source,
        scope.owner,
      ),
    );
    if (!current(held)) {
      release(scope, value.lease_id);
      throw Error(t("Session remplacée ou déconnectée. Reconnectez-vous."));
    }
    try {
      accept(scope, value, requestedAt);
      schedule();
    } catch (failure) {
      release(scope, value.lease_id);
      throw failure;
    }
  }
  createEffect(() => {
    const owners = { local: input.session("local"), server: input.session("server") },
      held = captured;
    if (held && held.owner !== owners[held.source])
      fail(t("Session remplacée ou déconnectée. Reconnectez-vous."));
  });
  onCleanup(() => {
    alive = false;
    stop();
  });
  return {
    capture,
    authorize: (media: ExternalParentalMedia) => capture()(media),
    stop,
    source: () => captured?.source,
    owner: () => captured?.owner,
    applies: (source: SourceId) => captured?.source === source,
    observe(next: "idle" | "connecting" | "playing" | "paused" | "ended" | "error") {
      lease?.consumption.playing(next === "playing");
      status = next;
      if (["idle", "paused", "ended", "error"].includes(next)) stop();
      else if (next === "playing") schedule();
      else {
        clearTimeout(renewal);
        renewal = undefined;
      }
    },
  };
}

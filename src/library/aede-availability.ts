import { batch, createEffect, createSignal, on } from "solid-js";
import type { SourceId } from "./sources";
/** Readable diagnostics never expose the JavaScript Error wrapper. */
export function errorMessage(value: unknown): string {
  return (value instanceof Error ? value.message : String(value ?? "")).replace(
    /(^| · )Error: /gm,
    "$1",
  );
}
/** Recognize only the bridge's transport refusal, not permissions, cache failures or other services. */
export function isAedeConnectionError(value: unknown): boolean {
  return /^(?:(?:Local|Serveur|Server) · )?(?:Error: )?(?:Impossible de joindre Aède\.|Unable to reach Aède\.)$/.test(
    errorMessage(value),
  );
}
/** Reachability belongs to the exact native login; old replies cannot affect another account. */
export function createAedeAvailability() {
  const [sources, setSources] = createSignal<
    Partial<Record<SourceId, { ticket: string; offline: boolean }>>
  >({});
  const [recovery, setRecovery] = createSignal(0);
  function update(source: SourceId, ticket: string | undefined, offline: boolean) {
    setSources((held) =>
      !ticket || held[source]?.ticket !== ticket || held[source]?.offline === offline
        ? held
        : { ...held, [source]: { ticket, offline } },
    );
  }
  return {
    owner(source: SourceId, ticket?: string) {
      setSources((held) => ({
        ...held,
        [source]: ticket ? { ticket, offline: false } : undefined,
      }));
    },
    success(source: SourceId, ticket: string | undefined) {
      const held = sources()[source];
      if (!ticket || held?.ticket !== ticket || !held.offline) return;
      batch(() => {
        update(source, ticket, false);
        setRecovery((value) => value + 1);
      });
    },
    recovery,
    failure(source: SourceId, ticket: string | undefined, failure: unknown) {
      if (isAedeConnectionError(failure)) update(source, ticket, true);
    },
    ownsSession: () => Object.values(sources()).some(Boolean),
    unavailable: () =>
      (["local", "server"] as const).filter((source) => sources()[source]?.offline),
  };
}
/** Shared by typed IPC and the application-wide outage notice, including both catalogue sources. */
export const aedeAvailability = createAedeAvailability();

/** Shared outage notices replace only transport messages; actionable refusals stay beside the action. */
export function inlineAedeError(value: unknown, centralized: boolean): string {
  const message = errorMessage(value);
  return centralized
    ? message
        .split("\n")
        .filter((line) => !isAedeConnectionError(line))
        .join("\n")
    : message;
}

/** Only failed reads opt in: a confirmed recovery retries them once, never a write or playback action. */
export function retryAedeReadOnRecovery(error: () => unknown, retry: () => unknown) {
  createEffect(
    on(
      aedeAvailability.recovery,
      () => {
        if (isAedeConnectionError(error())) void retry();
      },
      { defer: true },
    ),
  );
}

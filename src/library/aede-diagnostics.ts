import { batch, createSignal } from "solid-js";
import { errorMessage, isAedeConnectionError } from "./aede-availability";
import type { SourceId } from "./sources";

export type AedeDiagnosticKind = "personal-data" | "server" | "connection" | "request";
export interface AedeDiagnostic {
  at: number;
  source: SourceId;
  method: string;
  route: string;
  kind: AedeDiagnosticKind;
}
/** Recognize old and current native wording without treating another service's errors as Aède. */
export function isAedeDiagnosticError(value: unknown): boolean {
  return /(?:Erreur interne du serveur Aède\.|Internal Aède server error\.|Les données personnelles ne peuvent pas être lues par Aède\.|Aède cannot read personal data\.)/.test(
    errorMessage(value),
  );
}
function kind(value: unknown): AedeDiagnosticKind {
  const message = errorMessage(value);
  if (
    /Les données personnelles ne peuvent pas être lues par Aède\.|Aède cannot read personal data\./.test(
      message,
    )
  )
    return "personal-data";
  if (isAedeDiagnosticError(message)) return "server";
  return isAedeConnectionError(value) ? "connection" : "request";
}
// Endpoint labels are presentation only, never an alternative IPC admission policy.
const endpoints = new Set(
  "session password status roots accounts tasks source-review network-audio presentation stats doctor analysis album artist track lyrics waveform query labels label missing parental annotation annotations preferences moods m3u m3u-files collections collection search achievements album-listening history background-priority mood-features check analyze generate spectrum scan fetch exports".split(
    " ",
  ),
);
function routeLabel(path: string): string {
  const match = /^(\/api\/(?:(?:auth|me|admin)\/)?v1\/)([a-z0-9-]+)(\/[^?#]*)?$/.exec(path);
  if (!match || !endpoints.has(match[2]!)) return "—";
  return `${match[1]}${match[2]}${match[3] ? "/…" : ""}`;
}
/** At most 64 sanitized failures, in memory for the exact current local/server logins only. */
export function createAedeDiagnostics(now: () => number = Date.now) {
  const owners: Partial<Record<SourceId, string>> = {};
  const [rows, setRows] = createSignal<readonly AedeDiagnostic[]>([]);
  const [opened, setOpened] = createSignal(false);
  return {
    rows,
    opened,
    open: () => setOpened(true),
    close: () => setOpened(false),
    owner(source: SourceId, ticket?: string) {
      if (owners[source] === ticket) return;
      if (ticket) owners[source] = ticket;
      else delete owners[source];
      batch(() => {
        setOpened(false);
        setRows((held) => held.filter((row) => row.source !== source));
      });
    },
    failure(
      source: SourceId,
      ticket: string | undefined,
      method: string,
      path: string,
      error: unknown,
    ) {
      if (
        !ticket ||
        owners[source] !== ticket ||
        !["GET", "POST", "PUT", "PATCH", "DELETE"].includes(method)
      )
        return;
      const row = { at: now(), source, method, route: routeLabel(path), kind: kind(error) };
      setRows((held) => [row, ...held].slice(0, 64));
    },
  };
}
export const aedeDiagnostics = createAedeDiagnostics();

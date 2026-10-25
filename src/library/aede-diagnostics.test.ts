import { expect, it } from "vitest";
import { createAedeDiagnostics, isAedeDiagnosticError } from "./aede-diagnostics";
const failure = "Erreur interne du serveur Aède. Consultez son journal.";
it("keeps only the newest 64 failures and never retains raw server data or parameters", () => {
  let time = 0;
  const log = createAedeDiagnostics(() => ++time);
  log.owner("local", "local-ticket");
  for (let i = 0; i < 70; i++)
    log.failure(
      "local",
      "local-ticket",
      "GET",
      "/api/me/v1/preferences",
      `${failure} SECRET /private/music token=secret`,
    );
  expect(log.rows()).toHaveLength(64);
  expect(log.rows()[0]).toEqual({
    at: 70,
    source: "local",
    method: "GET",
    route: "/api/me/v1/preferences",
    kind: "server",
  });
  expect(log.rows().at(-1)?.at).toBe(7);
  expect(JSON.stringify(log.rows())).not.toMatch(/SECRET|private|token|ticket/);
});
it("retires replaced owners and late failures while preserving the other connected source", () => {
  const log = createAedeDiagnostics();
  log.owner("local", "local");
  log.owner("server", "first");
  log.failure("local", "local", "GET", "/api/me/v1/collections", failure);
  log.failure("server", "first", "GET", "/api/me/v1/history", failure);
  log.owner("server", "first");
  expect(log.rows()).toHaveLength(2);
  log.open();
  log.owner("server", "second");
  expect(log.opened()).toBe(false);
  log.failure("server", "first", "GET", "/api/me/v1/history", failure);
  expect(log.rows().map((row) => row.source)).toEqual(["local"]);
  log.owner("local");
  log.failure("local", undefined, "GET", "/api/me/v1/history", failure);
  expect(log.rows()).toEqual([]);
});
it("redacts account/task/file identifiers, queries, unknown routes and foreign error text", () => {
  const log = createAedeDiagnostics();
  log.owner("server", "current");
  for (const path of [
    "/api/admin/v1/accounts/private-person/parental",
    "/api/admin/v1/tasks/private-job",
    "/api/me/v1/m3u-files/private-file",
    "/api/me/v1/preferences?token=SECRET",
    "/api/v1/SECRET",
    "https://private.invalid",
  ])
    log.failure("server", "current", "GET", path, "Untrusted SECRET response");
  expect(log.rows().map((row) => row.route)).toEqual([
    "—",
    "—",
    "—",
    "/api/me/v1/m3u-files/…",
    "/api/admin/v1/tasks/…",
    "/api/admin/v1/accounts/…",
  ]);
  expect(log.rows().every((row) => row.kind === "request")).toBe(true);
  expect(JSON.stringify(log.rows())).not.toMatch(/private|SECRET/);
});
it("offers diagnostics for known bilingual server refusals, including source prefixes", () => {
  for (const message of [
    failure,
    "Local · Error: Internal Aède server error. Check its log.",
    "Les données personnelles ne peuvent pas être lues par Aède. Vérifiez la compatibilité de sa version.",
    "Aède cannot read personal data. Check engine version compatibility.",
  ])
    expect(isAedeDiagnosticError(message)).toBe(true);
  expect(isAedeDiagnosticError("Another server failed")).toBe(false);
  const log = createAedeDiagnostics();
  log.owner("local", "current");
  log.failure(
    "local",
    "current",
    "GET",
    "/api/me/v1/preferences",
    "Aède cannot read personal data. Check engine version compatibility.",
  );
  expect(log.rows()[0]?.kind).toBe("personal-data");
  log.failure("local", "current", "GET", "/api/v1/status", "Impossible de joindre Aède.");
  expect(log.rows()[0]?.kind).toBe("connection");
});

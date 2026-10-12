import { createMemo, createResource, createSignal, onCleanup } from "solid-js";
import { requestAede } from "../platform/desktop";
import { referenceSource } from "./sources";
import { parseLyrics } from "./lyrics";
import type { Job } from "./jobs";
import type { AccountSession } from "./server";
/** Probe all distinct occurrences serially and admit each answer only to its exact queue owners.
 * A later exact-track read supersedes an earlier retained-state probe of that same track.
 */
export function createQueueLyricAvailability(library: {
  queue: () => readonly { reference: string }[];
  sessionFor: (reference: string) => AccountSession | undefined;
  jobs: () => readonly Job[];
}) {
  const identity = createMemo(
    () => {
      const references = [...new Set(library.queue().map((row) => row.reference))].sort();
      return { references, owners: references.map((reference) => library.sessionFor(reference)) };
    },
    undefined,
    {
      equals: (a, b) =>
        a.references.join("\n") === b.references.join("\n") &&
        a.owners.every((owner, index) => owner === b.owners[index]),
    },
  );
  type Identity = ReturnType<typeof identity>;
  const [state, setState] = createSignal<{
    held: Identity;
    entries: Map<string, boolean>;
    error: string;
  }>();
  let disposed = false,
    serial = 0,
    generation = 0;
  const latest = new Map<string, number>();
  let latestIdentity: Identity | undefined;
  onCleanup(() => {
    disposed = true;
  });
  const current = (held: Identity) =>
    !disposed && identity() === held && held.owners.every(Boolean);
  async function read(reference: string, owner: AccountSession | undefined): Promise<boolean> {
    const held = identity(),
      ticket = ++serial;
    if (!owner || disposed || library.sessionFor(reference) !== owner) return false;
    if (latestIdentity !== held) {
      latest.clear();
      latestIdentity = held;
    }
    if (held.references.includes(reference)) latest.set(reference, ticket);
    const available = !!parseLyrics(
      await requestAede(
        "/api/v1/lyrics",
        { track: reference },
        "GET",
        null,
        referenceSource(reference),
        owner,
      ),
      reference,
    )?.lines.some((line) => line.text.trim());
    if (
      current(held) &&
      held.references.includes(reference) &&
      library.sessionFor(reference) === owner &&
      latest.get(reference) === ticket
    ) {
      setState((previous) => {
        const entries = previous?.held === held ? previous.entries : new Map<string, boolean>();
        entries.set(reference, available);
        return { held, entries, error: previous?.held === held ? previous.error : "" };
      });
    }
    return available;
  }
  const trigger = createMemo(
    () => {
      const held = identity();
      const completed = new Map<string, number>();
      const references = new Set(held.references);
      for (const job of library.jobs()) {
        if (
          job.kind === "lyrics" &&
          job.status === "completed" &&
          job.release &&
          references.has(job.release) &&
          (job.source ?? "server") === referenceSource(job.release)
        )
          completed.set(job.release, Math.max(completed.get(job.release) ?? 0, job.task_id));
      }
      const revision = JSON.stringify([...completed].sort(([a], [b]) => a.localeCompare(b)));
      return { held, completed, revision };
    },
    undefined,
    { equals: (a, b) => a.held === b.held && a.revision === b.revision },
  );
  let observed: { held: Identity; completed: Map<string, number> } | undefined;
  const [result, { refetch }] = createResource(
    () =>
      trigger().held.references.length && trigger().held.owners.every(Boolean) ? trigger() : false,
    async ({ held, completed }) => {
      const epoch = ++generation;
      const currentFetch = () => current(held) && epoch === generation;
      const prior = state();
      const references = held.references.filter(
        (reference) =>
          prior?.held !== held ||
          !prior.entries.has(reference) ||
          (completed.has(reference) &&
            (observed?.held !== held ||
              observed.completed.get(reference) !== completed.get(reference))),
      );
      const seen =
        observed?.held === held ? new Map(observed.completed) : new Map<string, number>();
      observed = { held, completed: seen };
      if (currentFetch())
        setState((previous) => ({
          held,
          entries: previous?.held === held ? previous.entries : new Map(),
          error: "",
        }));
      for (const reference of references) {
        if (!currentFetch()) break;
        try {
          await read(reference, library.sessionFor(reference));
          const version = completed.get(reference);
          if (currentFetch() && version !== undefined) seen.set(reference, version);
        } catch (failure) {
          if (currentFetch())
            setState((previous) => ({
              held,
              entries: previous?.held === held ? previous.entries : new Map(),
              error: String(failure),
            }));
        }
      }
    },
  );
  const retained = () => {
    const value = state(),
      held = identity();
    return current(held) && value?.held === held && (value.entries.size > 0 || value.error)
      ? {
          complete:
            value.entries.size === held.references.length &&
            [...value.entries.values()].every(Boolean),
          error: value.error,
        }
      : undefined;
  };
  return {
    read,
    available: (reference: string) => {
      const held = identity(),
        value = state();
      return current(held) && value?.held === held ? value.entries.get(reference) : undefined;
    },
    retained,
    loading: () => current(identity()) && result.loading,
    refresh: () => void refetch(),
  };
}

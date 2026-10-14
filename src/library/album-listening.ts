import { createEffect, createMemo, createSignal } from "solid-js";
import { t } from "../i18n";
import { requestAede } from "../platform/desktop";
import type { AccountSession } from "./server";
import { sourceLabel, referenceSource, type SourceId } from "./sources";
import { createDiagnosticRead } from "./diagnostic-read";
interface ListeningPage {
  total: number;
  offset: number;
  items: { reference: string; completed: boolean }[];
}
function hasControlCharacters(value: string): boolean {
  for (let index = 0; index < value.length; index++) if (value.charCodeAt(index) < 32) return true;
  return false;
}
/** A completion answer is private, bounded and source-qualified; an absent answer is unknown. */
export function parseAlbumListening(raw: unknown, source: SourceId, offset: number): ListeningPage {
  if (!raw || typeof raw !== "object") throw new Error(t("État d’écoute Aède invalide."));
  const page = raw as ListeningPage;
  if (
    !Number.isSafeInteger(page.total) ||
    page.total < 0 ||
    page.total > 250000 ||
    page.offset !== offset ||
    !Array.isArray(page.items) ||
    page.items.length > 200 ||
    page.items.length !== Math.min(200, Math.max(0, page.total - offset)) ||
    page.items.some(
      (row) =>
        !row ||
        typeof row.reference !== "string" ||
        !row.reference.startsWith("release:") ||
        row.reference.length > 16384 ||
        row.reference.length <= 8 ||
        hasControlCharacters(row.reference) ||
        referenceSource(row.reference) !== source ||
        typeof row.completed !== "boolean",
    ) ||
    new Set(page.items.map((row) => row.reference)).size !== page.items.length
  )
    throw new Error(t("État d’écoute Aède invalide."));
  return page;
}
/** Refresh only on account or confirmed transport milestones, never on clock/volume ticks. */
export function createAlbumListening(options: {
  enabled: () => boolean;
  session: (source: SourceId) => AccountSession | undefined;
  checkpoint: () => string;
}) {
  const owners = createMemo(() =>
    options.enabled()
      ? (["local", "server"] as const).flatMap((source) => {
          const account = options.session(source);
          return account ? [{ source, account }] : [];
        })
      : [],
  );
  const [held, setHeld] = createSignal<{
    owners: ReturnType<typeof owners>;
    values: Map<string, boolean>;
  }>();
  const checkpoint = createMemo(() => (owners().length ? options.checkpoint() : ""));
  createEffect(() => {
    if (held() && held()!.owners !== owners()) setHeld(undefined);
  });
  const read = createDiagnosticRead(
    () => (owners().length ? { owners: owners(), checkpoint: checkpoint() } : false),
    async (key, admission) => {
      const values = new Map<string, boolean>();
      const errors: string[] = [];
      let estimatedBytes = 0;
      for (const owner of key.owners) {
        const current = () =>
          admission.current() &&
          owners() === key.owners &&
          options.session(owner.source) === owner.account;
        const sourceBytes = estimatedBytes;
        try {
          const info = await requestAede<{ capabilities?: string[] }>(
            "/api/v1/status",
            {},
            "GET",
            null,
            owner.source,
            owner.account,
          );
          if (!current()) return undefined;
          if (!Array.isArray(info.capabilities) || !info.capabilities.includes("album_listening"))
            throw new Error(t("Mettez à jour puis redémarrez Aède pour les états d’écoute."));
          let total: number | undefined;
          const entries = new Map<string, boolean>();
          for (let offset = 0; total === undefined || offset < total; offset += 200) {
            const page = parseAlbumListening(
              await requestAede(
                "/api/me/v1/album-listening",
                { offset: String(offset), limit: "200" },
                "GET",
                null,
                owner.source,
                owner.account,
              ),
              owner.source,
              offset,
            );
            if (!current()) return undefined;
            if (total !== undefined && page.total !== total)
              throw new Error(t("État d’écoute Aède invalide."));
            total = page.total;
            for (const row of page.items) {
              if (entries.has(row.reference)) throw new Error(t("État d’écoute Aède invalide."));
              estimatedBytes += row.reference.length * 2 + 64;
              if (estimatedBytes > 16 * 1024 * 1024)
                throw new Error(t("Les états d’écoute dépassent la limite de mémoire."));
              entries.set(row.reference, row.completed);
            }
          }
          for (const [reference, completed] of entries) values.set(reference, completed);
        } catch (failure) {
          if (!current()) return undefined;
          estimatedBytes = sourceBytes;
          errors.push(
            `${sourceLabel(owner.source)} · ${failure instanceof Error ? failure.message : t("État d’écoute indisponible.")}`,
          );
        }
      }
      return { values, error: errors.join(" · ") };
    },
  );
  createEffect(() => {
    const value = read.current();
    if (value) setHeld({ owners: owners(), values: value.values });
  });
  return {
    completed: (reference: string) =>
      held()?.owners === owners() ? held()?.values.get(reference) : undefined,
    error: () => read.current()?.error ?? read.error(),
  };
}

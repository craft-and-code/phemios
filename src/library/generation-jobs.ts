import { createEffect, createSignal, onCleanup } from "solid-js";
import { t } from "../i18n";
import { requestAede } from "../platform/desktop";
import type { AccountSession } from "./server";
import type { SourceId } from "./sources";
import type { Job } from "./jobs";
import {
  administrativeWorkActive,
  validGenerationSteps,
  type GenerationStep,
} from "./generation-policy";
/** Server-owned plans survive view closure; admission stays tied to the captured authenticated source. */
export function createGenerations(options: {
  jobs: () => readonly Job[];
  session: (source: SourceId) => AccountSession | undefined;
  recover?: (source: SourceId) => Promise<unknown>;
  accepted: (task: { task_id: number; status: "queued" }, kind: string, source: SourceId) => void;
}) {
  const [held, setHeld] = createSignal<{
    source: SourceId;
    owner: AccountSession;
    steps: readonly GenerationStep[];
  }>();
  let sequence = 0,
    alive = true;
  onCleanup(() => {
    alive = false;
    sequence++;
  });
  createEffect(() => {
    const pending = held();
    if (pending && options.session(pending.source) !== pending.owner) {
      sequence++;
      setHeld(undefined);
    }
  });
  async function start(source: SourceId, input: readonly GenerationStep[]) {
    if (!validGenerationSteps(input)) throw new Error(t("Plan de génération invalide."));
    if (held() || administrativeWorkActive(options.jobs()))
      throw new Error(t("Un traitement Aède est déjà actif."));
    const owner = options.session(source),
      steps = [...input];
    if (owner?.account.role !== "admin") throw new Error(t("Droits administrateur nécessaires."));
    const ticket = ++sequence;
    const current = () => alive && sequence === ticket && options.session(source) === owner;
    setHeld({ source, owner, steps });
    let submitted = false;
    try {
      const info = await requestAede<{ capabilities?: string[] }>(
        "/api/v1/status",
        {},
        "GET",
        null,
        source,
        owner,
      );
      if (!current()) throw new Error(t("Session invalide."));
      if (!Array.isArray(info.capabilities) || !info.capabilities.includes("library_generations"))
        throw new Error(
          t("Mettez à jour puis redémarrez Aède pour les générations de bibliothèque."),
        );
      submitted = true;
      const result = await requestAede<{ task_id: number; status: "queued" }>(
        "/api/admin/v1/generate",
        {},
        "POST",
        { steps },
        source,
        owner,
      );
      if (!current()) throw new Error(t("Session invalide."));
      if (
        !Number.isSafeInteger(result.task_id) ||
        result.task_id <= 0 ||
        result.status !== "queued"
      )
        throw new Error(t("Suivi de tâche Aède invalide."));
      options.accepted(result, `generate_${steps.length === 1 ? steps[0] : "all"}`, source);
      return result.task_id;
    } catch (failure) {
      if (submitted && current()) await options.recover?.(source);
      throw failure;
    } finally {
      if (sequence === ticket) setHeld(undefined);
    }
  }
  return { start, pending: held };
}

import { t, locale } from "../i18n";
import type { SourceReviewItem, ReviewDecision } from "./source-review";
import type { EnrichmentOptions } from "./enrichment";
/** Review persistence and explicit background work are separate: a failed launch never undoes consent. */
export async function applySourceReview(options: {
  row: SourceReviewItem;
  decision?: ReviewDecision;
  biography: boolean;
  current: () => boolean;
  decide: (decision: ReviewDecision) => Promise<SourceReviewItem>;
  launch: (options: EnrichmentOptions) => Promise<{ task: number } | { error: string } | undefined>;
  saved: (row: SourceReviewItem) => void;
}): Promise<string> {
  if (!options.current()) return "";
  let row = options.row;
  const language = locale();
  if (options.decision) {
    row = await options.decide(options.decision);
    if (!options.current()) return "";
    options.saved(row);
  }
  if (!options.biography) return t("Correspondance enregistrée dans Aède.");
  if (row.kind !== "artist" || row.decision !== "accepted")
    throw new Error(t("Validez d’abord la correspondance de l’artiste."));
  try {
    if (!options.current()) return "";
    const result = await options.launch({
      summaries: true,
      artist: row.reference,
      full: true,
      yes: true,
      lang: language,
    });
    if (!options.current()) return "";
    if (!result) throw new Error(t("Un enrichissement est déjà en cours."));
    if ("error" in result) throw new Error(result.error);
    return t("Correspondance validée. Récupération de la biographie : tâche #{0}.", result.task);
  } catch (failure) {
    if (!options.current()) return "";
    throw new Error(
      t(
        "Correspondance conservée ; récupération non lancée : {0}",
        failure instanceof Error ? failure.message : String(failure),
      ),
    );
  }
}

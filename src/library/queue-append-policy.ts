import { t } from "../i18n";
import { referenceSource } from "./sources";
/** A visible refusal never silently switches native authority or replaces the queue. */
export function queueAppendReason(
  reference: string,
  state: { role: string | undefined; busy: boolean; device: string; first: string | undefined },
) {
  if (!state.role) return t("Connectez-vous pour ajouter à la liste de lecture.");
  if (state.role === "auditor") return t("Votre compte ne permet pas la lecture.");
  if (state.device === "@hqplayer")
    return t("L’ajout à la file HQPlayer n’est pas pris en charge.");
  if (state.first && referenceSource(state.first) !== referenceSource(reference))
    return t("Lecture de plusieurs origines non prise en charge dans une seule file.");
  return state.busy ? t("Lecteur occupé, réessayez.") : "";
}

import { t } from "../i18n";
import type { Section } from "./routes";
/** Only Your music advertises view-local search; catalogue/detail wording stays general. */
export function searchContext(section?: Section) {
  let message: string | undefined;
  switch (section) {
    case "moods":
      message = t("Rechercher une ambiance");
      break;
    case "favourites":
      message = t("Rechercher dans les favoris");
      break;
    case "rated":
      message = t("Rechercher dans les albums notés");
      break;
    case "tags":
      message = t("Rechercher un tag");
      break;
    case "collections":
      message = t("Rechercher une collection");
      break;
    case "history":
      message = t("Rechercher dans l’historique");
      break;
    case "playlists":
      message = t("Rechercher dans les listes de lecture");
      break;
  }
  return message
    ? { contextual: true, label: message, placeholder: message }
    : {
        contextual: false,
        label: t("Rechercher dans tous les champs du catalogue"),
        placeholder: t("Artiste, titre, pays, genre, tag…"),
      };
}

import { t } from "../i18n";
import type { Section } from "./routes";
/** Header search advertises only the filters consumed by the current view. */
export function searchContext(section?: Section) {
  if (
    [
      "playback",
      "radio",
      "podcasts",
      "cd",
      "concerts",
      "players",
      "doctor",
      "statistics",
      "achievements",
    ].includes(section ?? "")
  ) {
    const message = t("Recherche indisponible dans cette vue");
    return { disabled: true, contextual: false, label: message, placeholder: message };
  }
  let message: string | undefined;
  switch (section) {
    case "relations":
      message = t("Rechercher un artiste dans les relations");
      break;
    case "encyclopedia":
      message = t("Rechercher un article");
      break;
    case "analysis":
      message = t("Rechercher dans les analyses");
      break;
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
    ? { disabled: false, contextual: true, label: message, placeholder: message }
    : {
        disabled: false,
        contextual: false,
        label: t("Rechercher dans tous les champs du catalogue"),
        placeholder: t("Artiste, titre, pays, genre, tag…"),
      };
}

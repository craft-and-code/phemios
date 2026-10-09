import { t } from "../i18n";
interface Report {
  md5: string;
  stale: boolean | undefined;
  error: string;
  summary: string;
  eventCount: number | undefined;
  clipped: boolean | undefined;
}
/** Integrity and detection conclusions are independent of artistic/audio quality. */
export function analysisReading(data: Report) {
  const state = data.md5.toLowerCase();
  let integrity = {
    tone: "unknown",
    label: t("Intégrité non vérifiée"),
    detail: t("Une signature absente ou non vérifiée ne signifie pas que le fichier est corrompu."),
  };
  if (state === "match")
    integrity = {
      tone: "good",
      label: t("Intégrité vérifiée"),
      detail: t("L’audio décodé correspond au MD5 FLAC conservé dans ce rapport."),
    };
  if (state === "mismatch")
    integrity = {
      tone: "bad",
      label: t("MD5 différent"),
      detail: t("L’audio décodé ne correspond pas à la signature FLAC : contrôlez la source."),
    };
  if (state === "error" || data.error)
    integrity = {
      tone: "bad",
      label: t("Vérification en erreur"),
      detail: data.error || t("Le contrôle MD5 n’a pas pu aboutir."),
    };
  if (data.stale !== false)
    integrity = {
      tone: "unknown",
      label: data.stale ? t("Analyse à renouveler") : t("Validité non confirmée"),
      detail: t(
        "{0} dans le rapport conservé ; cela ne confirme pas le fichier actuel.",
        integrity.label,
      ),
    };
  const flagged = data.summary.toLowerCase() === "flagged",
    clean = data.summary.toLowerCase() === "clean";
  const findings = {
    tone: flagged ? "warning" : "unknown",
    label: flagged
      ? t("Indices détectés")
      : clean
        ? t("Aucun indice détecté")
        : t("Détections non renseignées"),
    detail: clean
      ? t(
          "Aucun indice dans les contrôles réalisés. Ce résultat ne prouve ni l’origine ni la qualité du son.",
        )
      : t(
          "Les détections sont des indices à examiner avec leur explication, pas une note de qualité.",
        ),
  };
  const audible = data.clipped === true || (data.eventCount ?? 0) > 0;
  const listening = {
    tone: audible ? "warning" : "unknown",
    label: audible
      ? t("Passages à écouter")
      : data.clipped === false && data.eventCount === 0
        ? t("Aucun événement signalé")
        : t("Contrôles partiels"),
    detail: [
      data.clipped === true
        ? t("Écrêtage détecté.")
        : data.clipped === false
          ? t("Aucun écrêtage signalé.")
          : t("Écrêtage non renseigné."),
      data.eventCount === undefined
        ? t("Nombre de clics/coupures inconnu.")
        : t("{0} clic(s)/coupure(s) détecté(s).", data.eventCount),
      t("Ces détections peuvent aussi venir de l’enregistrement ; écoutez les passages concernés."),
    ].join(" "),
  };
  return [integrity, findings, listening];
}
export const measurementHelp: Record<string, string> = {
  "Niveau intégré": t("Volume perçu moyen. Plus près de zéro signifie plus fort, pas meilleur."),
  Dynamique: t(
    "Écart de niveau mesuré. Il décrit le signal et le mastering, sans noter leur qualité.",
  ),
  "Étendue de sonie": t(
    "Variations de volume au cours du morceau ; elles dépendent aussi de la musique.",
  ),
  "Crête échantillon": t(
    "Valeur maximale des échantillons. Le drapeau d’écrêtage est indiqué séparément.",
  ),
  "Crête vraie": t(
    "Estimation des crêtes entre les échantillons ; ce n’est pas une mesure de la sortie physique.",
  ),
  "Précision déclarée": t("Résolution annoncée par le conteneur."),
  "Précision mesurée": t(
    "Résolution estimée dans le signal. Une différence avec le conteneur ne prouve pas une mauvaise écoute.",
  ),
  "Coupure spectrale": t(
    "Bande passante mesurée. Une coupure ne prouve pas à elle seule une conversion avec pertes.",
  ),
  "Corrélation stéréo": t(
    "Relation entre les canaux. Une valeur faible ou négative peut être un choix artistique.",
  ),
  "Balance D/G": t(
    "Différence de niveau entre droite et gauche ; à interpréter selon l’enregistrement.",
  ),
};

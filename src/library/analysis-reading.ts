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
    label: "Intégrité non vérifiée",
    detail: "Une signature absente ou non vérifiée ne signifie pas que le fichier est corrompu.",
  };
  if (state === "match")
    integrity = {
      tone: "good",
      label: "Intégrité vérifiée",
      detail: "L’audio décodé correspond au MD5 FLAC conservé dans ce rapport.",
    };
  if (state === "mismatch")
    integrity = {
      tone: "bad",
      label: "MD5 différent",
      detail: "L’audio décodé ne correspond pas à la signature FLAC : contrôlez la source.",
    };
  if (state === "error" || data.error)
    integrity = {
      tone: "bad",
      label: "Vérification en erreur",
      detail: data.error || "Le contrôle MD5 n’a pas pu aboutir.",
    };
  if (data.stale !== false)
    integrity = {
      tone: "unknown",
      label: data.stale ? "Analyse à renouveler" : "Validité non confirmée",
      detail: `${integrity.label} dans le rapport conservé ; cela ne confirme pas le fichier actuel.`,
    };
  const flagged = data.summary.toLowerCase() === "flagged",
    clean = data.summary.toLowerCase() === "clean";
  const findings = {
    tone: flagged ? "warning" : "unknown",
    label: flagged
      ? "Indices détectés"
      : clean
        ? "Aucun indice détecté"
        : "Détections non renseignées",
    detail: clean
      ? "Aucun indice dans les contrôles réalisés. Ce résultat ne prouve ni l’origine ni la qualité du son."
      : "Les détections sont des indices à examiner avec leur explication, pas une note de qualité.",
  };
  const audible = data.clipped === true || (data.eventCount ?? 0) > 0;
  const listening = {
    tone: audible ? "warning" : "unknown",
    label: audible
      ? "Passages à écouter"
      : data.clipped === false && data.eventCount === 0
        ? "Aucun événement signalé"
        : "Contrôles partiels",
    detail: [
      data.clipped === true
        ? "Écrêtage détecté."
        : data.clipped === false
          ? "Aucun écrêtage signalé."
          : "Écrêtage non renseigné.",
      data.eventCount === undefined
        ? "Nombre de clics/coupures inconnu."
        : `${data.eventCount} clic(s)/coupure(s) détecté(s).`,
      "Ces détections peuvent aussi venir de l’enregistrement ; écoutez les passages concernés.",
    ].join(" "),
  };
  return [integrity, findings, listening];
}
export const measurementHelp: Record<string, string> = {
  "Niveau intégré": "Volume perçu moyen. Plus près de zéro signifie plus fort, pas meilleur.",
  Dynamique:
    "Écart de niveau mesuré. Il décrit le signal et le mastering, sans noter leur qualité.",
  "Étendue de sonie":
    "Variations de volume au cours du morceau ; elles dépendent aussi de la musique.",
  "Crête échantillon":
    "Valeur maximale des échantillons. Le drapeau d’écrêtage est indiqué séparément.",
  "Crête vraie":
    "Estimation des crêtes entre les échantillons ; ce n’est pas une mesure de la sortie physique.",
  "Précision déclarée": "Résolution annoncée par le conteneur.",
  "Précision mesurée":
    "Résolution estimée dans le signal. Une différence avec le conteneur ne prouve pas une mauvaise écoute.",
  "Coupure spectrale":
    "Bande passante mesurée. Une coupure ne prouve pas à elle seule une conversion avec pertes.",
  "Corrélation stéréo":
    "Relation entre les canaux. Une valeur faible ou négative peut être un choix artistique.",
  "Balance D/G":
    "Différence de niveau entre droite et gauche ; à interpréter selon l’enregistrement.",
};

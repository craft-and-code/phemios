import type { AnalysisModel } from "./model";
/** Hosts supply their own translator; source filenames and provider diagnostics remain literal. */
export type ReportTranslate = (message: string, ...parameters: unknown[]) => string;
export const french: ReportTranslate = (message, ...parameters) =>
  message.replace(/\{(\d+)\}/g, (match, n: string) =>
    Number(n) < parameters.length ? String(parameters[Number(n)]) : match,
  );
export interface ReportReading {
  tone: "good" | "warning" | "bad" | "unknown";
  label: string;
  detail: string;
  proof: string;
}
/** Embedded audio MD5, file hashes and Ogg page CRC remain separate controls. */
export function integrityReading(model: AnalysisModel): ReportReading {
  const checks: Record<string, ReportReading> = {
    Match: {
      tone: "good",
      label: "MD5 audio FLAC conforme",
      detail: "L’audio décodé correspond à la signature enregistrée dans le FLAC.",
      proof:
        "La comparaison porte sur l’audio entièrement décodé et la signature interne STREAMINFO. Les tags et la pochette n’entrent pas dans ce contrôle.",
    },
    Mismatch: {
      tone: "bad",
      label: "MD5 audio FLAC différent",
      detail: "L’audio décodé ne correspond pas à la signature enregistrée.",
      proof:
        "La comparaison a abouti, mais les signatures diffèrent. Vérifiez le fichier ou sa source ; la cause exacte n’est pas déterminée par ce seul résultat.",
    },
    NoSignature: {
      tone: "unknown",
      label: "Aucune signature MD5 audio",
      detail: "Ce FLAC ne contient pas de signature de référence exploitable.",
      proof:
        "Ce n’est pas un résultat KO. L’empreinte du fichier entier est une information différente.",
    },
    Present: {
      tone: "unknown",
      label: "MD5 audio présent, non vérifié",
      detail: "La signature existe, mais sa comparaison n’a pas été effectuée.",
      proof: "L’existence d’une signature ne confirme pas que l’audio lui correspond.",
    },
    Error: {
      tone: "bad",
      label: "Vérification MD5 interrompue",
      detail: "Le contrôle MD5 n’a pas pu aboutir.",
      proof: "Une erreur de lecture se distingue d’une comparaison terminée avec un MD5 différent.",
    },
  };
  const unknown: ReportReading = {
    tone: "unknown",
    label: "Intégrité non vérifiée",
    detail: "Aucun verdict de vérification audio n’est fourni.",
    proof:
      "Une mesure absente n’est ni OK ni KO. Une empreinte du fichier seul ne vérifie pas son intégrité.",
  };
  const reading = model.applicableMd5
    ? (checks[model.md5State] ?? unknown)
    : {
        ...unknown,
        label:
          model.format.toUpperCase() === "OGG"
            ? "Ogg : contrôle des pages non fourni"
            : "MD5 audio FLAC non applicable",
        detail: "Ce rapport ne fournit pas de verdict d’intégrité pour ce format.",
      };
  if (model.stale === true)
    return {
      ...reading,
      tone: "warning",
      detail: "Le fichier a changé depuis cette analyse. Ce résultat concerne l’ancienne version.",
    };
  if (model.stale === undefined && reading.tone === "good")
    return {
      ...reading,
      detail: "Conforme dans le rapport ; le fichier actuel n’a pas été vérifié par Phémios.",
    };
  return reading;
}
/** Description scales are never quality scores or universal mastering targets. */
export const measureHelp: Record<string, string> = {
  "Niveau intégré": "Plus près de zéro signifie plus fort. Cela ne note pas la qualité du morceau.",
  Dynamique:
    "Rapport entre les crêtes et les passages soutenus les plus forts ; différent de la LRA.",
  "Étendue de sonie":
    "Variation des niveaux à court terme au fil du morceau ; interprétation approximative sous une minute.",
  "Crête échantillon":
    "Maximum des échantillons stockés. Le drapeau d’écrêtage est indiqué séparément.",
  "Crête vraie":
    "Estimation des crêtes entre les échantillons ; ce n’est pas une mesure de la sortie physique.",
  "Précision déclarée": "Profondeur annoncée par le conteneur pour un signal PCM entier.",
  "Précision mesurée":
    "Précision estimée du signal ; elle ne certifie pas l’origine de l’enregistrement.",
  "Coupure spectrale":
    "La coupure seule ne prouve pas un suréchantillonnage ni une conversion avec pertes.",
  "Corrélation stéréo": "Une valeur faible ou négative peut être un choix artistique.",
  "Balance D/G": "Différence RMS droite moins gauche, sans pondération.",
};

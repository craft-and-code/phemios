# Comprendre ses fichiers

Phémios présente plusieurs informations complémentaires. Un fichier intact n’est pas nécessairement un enregistrement de bonne qualité ; une mesure audio n’est pas une preuve d’authenticité.

## Tester un album maintenant

Dans la page Album, l’icône de test à droite de Pistes lance une vérification ponctuelle de son contenu. Une coche indique une réussite, une croix une erreur et un tiret l’absence de hash applicable. Les titres restent alignés. Cliquez sur une croix rouge pour lire le détail sans télécharger de rapport.

Ce résultat ponctuel ne remplace pas les analyses enregistrées. Selon le format, les signatures et les outils disponibles, les contrôles applicables diffèrent. [Aède explique les vérifications d’intégrité](https://craft-and-code.github.io/aede/docs/fr/cli/check.html).

## Consulter les analyses

La vue Analyses montre leur couverture pour éviter les relances inutiles. Triez le tableau par ses colonnes et ouvrez un album ou une piste pour voir les résultats disponibles. Les icônes de piste ouvrent les mesures, spectres et paroles correspondants.

Pour comprendre dynamique, niveau, crêtes, fréquences et limites d’interprétation, utilisez la [documentation FlacCompagnon](https://craft-and-code.github.io/FlacCompagnon/). Phémios ne convertit pas ces mesures en verdict absolu de qualité.

## Importer un résultat FlacCompagnon

Dans **Analyses**, choisissez **Importer une analyse**, à gauche d’Actualiser. Sélectionnez le JSON d’un album ou d’une piste exporté par FlacCompagnon. Cette consultation fonctionne sans connexion Aède ; elle ne modifie ni votre bibliothèque ni les résultats conservés par le serveur. Pour un album, choisissez la piste dans la liste. Le lien de retour restaure la couverture du catalogue.

Un seul chevron animé ouvre ou ferme toutes les informations complémentaires : vers la droite quand elles sont fermées, vers le bas quand une rubrique est ouverte. Chaque rubrique peut aussi être ouverte séparément ; ce choix est conservé dans vos préférences et leurs sauvegardes. Survolez un repère vert pour lire sa valeur et son explication, ou touchez/cliquez sa barre pour garder cette information affichée. Un second toucher/clic, un clic à l’extérieur ou Échap la ferme. Les marqueurs des clics et coupures affichent aussi leur début, leur durée et leur canal au survol ou au toucher/clic. Les chevrons ouvrent les explications, les mesures absentes et les empreintes. Le bouclier identifie le bloc MD5 ; les triangles signalent les indices à examiner. Un résultat Clean ne garantit pas l’origine de la source, et un MD5 conforme ne note pas le mastering.

Un MD5 importé est celui du rapport : Phémios n’ouvre pas l’audio pour en vérifier l’état actuel. Pour Ogg, l’empreinte du fichier ne remplace pas le contrôle des pages. Les JSON sont limités à 16 Mio et 2 000 pistes ; seuls les formats de rapport reconnus sont acceptés.

## Générer ou exporter

Un administrateur peut lancer les analyses et les spectres disponibles dans son moteur. Les actions signalent leur activité et permettent l’annulation proposée. Recalculer les résultats existants doit être choisi avant le lancement. Les actions déjà complètes restent désactivées lorsque le recalcul n’est pas demandé.

Paramètres → Aède propose les générations à l’échelle de la bibliothèque, une action ou une séquence. Les résultats JSON et les images de spectres peuvent être téléchargés lorsqu’ils existent. Le calcul, le stockage, les formats et les commandes sont documentés côté [Aède](https://craft-and-code.github.io/aede/docs/fr/index.html), pas dans ce manuel d’interface.

Une analyse JSON importée peut être consultée sans compte ni serveur. Ses coches indiquent le résultat enregistré par FlacCompagnon ; Phémios ne relance aucun calcul et ne vérifie pas à nouveau les fichiers audio. Un trait signale qu’aucun verdict exploitable n’est fourni, par exemple une signature absente ou non vérifiée.

Dans une page Album, le bouclier demande au moteur Aède un nouveau test d’intégrité. Avec un moteur prenant en charge les résultats progressifs, les coches et erreurs apparaissent piste après piste pendant le test. Arrêter conserve à l’écran les résultats déjà terminés ; quitter la page les efface. Une mise à jour et un redémarrage du moteur Aède sont nécessaires pour activer cette nouvelle capacité.

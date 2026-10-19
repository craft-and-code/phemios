# Écouter et composer sa séance

Le lecteur du bas reste disponible pendant la navigation. Sa pochette ouvre l’album ; le titre ouvre la piste et le nom d’artiste sa page. La barre du bas peut lancer la liste construite dans Listes de lecture, ou la sélection visible compatible.

## Les commandes essentielles

Lecture/pause, précédent, suivant et Stop contrôlent la source active. Espace lance ou suspend la lecture hors des champs de saisie et fenêtres de dialogue. Un clic sur le haut-parleur coupe ou rétablit le son ; le volume reste réglable avant de jouer et son niveau est mémorisé.

Cliquez dans la forme d’onde pour déplacer la tête de lecture. Le trait sous la souris indique la cible. Le clic sur la durée alterne temps total et temps restant. Une radio n’offre pas de déplacement dans un morceau enregistré.

## Sortie et traitements

L’icône des réglages audio choisit la sortie, selon les périphériques reconnus. Sans DSP et DSP correspondent à des politiques distinctes ; la disponibilité du bit-perfect dépend du transport et du matériel. Un flux PCM distant ne devient pas bit-perfect par un simple choix d’étiquette.

Le fondu entre les titres se règle en mode DSP. Mélanger deux morceaux transforme nécessairement leur signal. Les explications du moteur et les limites de sortie se trouvent chez [Aède](https://craft-and-code.github.io/aede/docs/fr/dsp/start.html). HQPlayer nécessite une installation distincte et un accès aux fichiers ; Phémios ne fournit pas HQPlayer.

## Récupérer les paroles

Les paroles déjà présentes dans les métadonnées ou les fichiers associés sont affichées lorsqu’elles sont reconnues. Sinon, leur récupération se demande explicitement ; elle ne démarre pas la lecture.

- **Pour une piste** : dans les actions de la piste, utilisez l’icône de paroles avec une flèche. L’info-bulle indique « Télécharger les paroles · LRCLIB, sans clé API ». Cette action nécessite un compte administrateur pour la source concernée.
- **Pour un album ou une liste** : utilisez l’action de téléchargement des paroles près des commandes de Pistes ou dans le volet Liste de lecture. Les indicateurs de chaque piste évoluent au fil du traitement ; l’action globale devient indisponible quand tout est déjà présent.
- **Pour toute la bibliothèque** : ouvrez **Paramètres → Aède**, sélectionnez la source si nécessaire, puis **Paroles**. Vous pouvez aussi cocher **Paroles** lors de [l’enrichissement](artists.md#recuperer-les-images-et-les-biographies).

LRCLIB ne demande pas de clé API. Les métadonnées du morceau servent à la recherche ; une absence de correspondance ne constitue pas une erreur de votre fichier. Aède conserve les paroles récupérées, notamment dans des fichiers associés `.lrc`, sans réécrire les tags du morceau. Les résultats peuvent être synchronisés ou sans temps : seuls les premiers suivent automatiquement la lecture. Les règles de récupération et de conservation sont décrites dans le [manuel Aède](https://craft-and-code.github.io/aede/docs/fr/index.html).

## Paroles et vue Lecture

L’icône de vue Lecture ouvre les visuels, sans changer de page automatiquement au démarrage d’une piste. Choisissez un effet ; recliquer le désactive. Le contrôle des fréquences alterne les styles de barres et leur masquage. Les paroles ordinaires peuvent être affichées ou masquées ; les paroles flottantes ont leur propre présentation.

Les paroles synchronisées suivent les temps fournis. Les textes sans temps utilisent les flèches de navigation manuelle. Dans la file, l’icône indique la disponibilité et permet une récupération explicite. Le téléchargement global poursuit son travail quand le volet est fermé ; l’action Stop permet d’interrompre les soumissions suivantes.

## Lecteurs réseau

Dans **Sortie et mode de lecture → Lecteurs réseau**, choisissez un appareil dans le sélecteur commun : OpenHome, Cast, SlimProto, puis UPnP. Un compte administrateur et un moteur Aède à jour sont nécessaires. Saisissez l’IPv4 privée de la machine qui exécute Aède si elle ne peut pas être reprise de la connexion, puis recherchez les appareils. Préparez une liste de 1 à 64 pistes de la même bibliothèque et utilisez **Écouter sur le lecteur réseau**. Aède, embarqué ou distant, transmet directement les fichiers originaux.

Pour **Cast**, inspectez le certificat, vérifiez son empreinte sur votre réseau de confiance, puis cochez la validation. Cette confiance n’est pas enregistrée durablement. Pour **OpenHome et Cast**, le remplacement d’une lecture ou d’une liste existante nécessite une autorisation explicite.

Pour **SlimProto**, ouvrez **Ajouter un lecteur SlimProto**, renseignez l’IPv4 du lecteur et ajoutez-le au même sélecteur. Après le lancement, connectez Squeezelite au serveur indiqué, par exemple `squeezelite -s ADRESSE_AEDE:3483`. La connexion est attendue pendant une minute ; un lecteur déjà connecté à un autre serveur doit être reconfiguré volontairement. Son volume est conservé et peut être initialement muet.

**Arrêter le lecteur réseau** demande l’arrêt ; un arrêt non confirmé reste signalé. Ces profils sont expérimentaux : les commandes du bas restent locales et ne pilotent pas le volume, le fondu ou le DSP du lecteur réseau. Aucun historique d’écoute n’est déduit du transfert. La perte de connexion ou de session demande l’arrêt, sans garantir que le lecteur a vidé ses données en mémoire. [Détails des profils dans Aède](https://craft-and-code.github.io/aede/).

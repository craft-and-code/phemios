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

## Lecteur réseau UPnP

Dans **Sortie et mode de lecture**, la section **UPnP** propose un premier raccordement avec un compte administrateur et un moteur Aède à jour. Si la connexion utilise déjà une IPv4 privée, elle est reprise automatiquement ; le crayon permet de la modifier. Sinon, saisissez l’adresse IPv4 réseau de la machine **qui exécute Aède**, puis lancez la recherche. `localhost` et une adresse de proxy ne désignent pas forcément cette interface réseau. Choisissez votre lecteur et préparez une liste de 1 à 64 pistes appartenant à la même bibliothèque. **Écouter sur le lecteur UPnP** arrête la lecture locale et demande à Aède de transmettre les fichiers originaux directement au lecteur. **Arrêter UPnP** demande l’arrêt ; un arrêt non confirmé est signalé.

Les boutons de cette section sont dédiés à UPnP : le transport du bas, le volume local, le DSP et le fondu ne pilotent pas encore ce lecteur réseau. La perte de la session ou du lien de contrôle déclenche une demande d’arrêt après un délai de sécurité ; le lecteur peut encore avoir du son en mémoire. [Limites du profil et détails serveur dans Aède](https://craft-and-code.github.io/aede/).

AirPlay n’est pas encore raccordé dans cette version.

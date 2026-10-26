# Premiers pas

Phémios est l’application de bureau pour parcourir et écouter votre CDthèque. Aède, son moteur intégré, construit le catalogue. Vous pouvez aussi connecter un serveur Aède, ou combiner les deux bibliothèques.

## Installer une version publiée

Téléchargez l’installateur correspondant à votre système depuis les [releases GitHub de Phémios](https://github.com/craft-and-code/phemios/releases). Les noms suivent le modèle `phemios-App-VERSION-PLATEFORME` : `.dmg` pour macOS Apple Silicon, `.msi` ou `.exe` pour Windows x64, `.AppImage`, `.deb` ou `.rpm` pour Linux x86_64. Quand une somme `.sha256` est publiée, vérifiez-la avant d’ouvrir l’installateur. Le moteur Aède local est inclus dans l’application ; un serveur Aède distant reste facultatif.

Sur macOS, ouvrez le fichier `.dmg`, glissez **Phémios** dans **Applications**, puis lancez-le. Si macOS bloque une application téléchargée parce qu’elle porte encore l’attribut de quarantaine, fermez Phémios et exécutez dans **Terminal** :

```
xattr -dr com.apple.quarantine "/Applications/Phémios.app"
```

Adaptez le chemin si vous avez installé l’application ailleurs, puis ouvrez-la à nouveau. Cette commande retire uniquement l’attribut de quarantaine de Phémios ; elle ne désactive pas Gatekeeper pour les autres applications.

Sur Windows, lancez le `.msi` ou le `.exe` et confirmez l’ouverture dans SmartScreen si Windows demande une validation. Sur Linux, rendez l’AppImage exécutable (`chmod +x Phémios.AppImage`, puis `./Phémios.AppImage`) ou installez le paquet `.deb`/`.rpm` avec le gestionnaire de votre distribution.

Le [catalogue de composants](../../components/index.html) permet aussi de découvrir l’interface avec des données fictives, sans installation, compte ou bibliothèque personnelle ; il ne lit pas de fichiers audio réels.

## Lancer depuis les sources

Pour lancer les sources, installez Node.js 22.12+ dans la branche 22, Node.js 24 ou 26+, Rust 1.90+ et les [prérequis Tauri](https://v2.tauri.app/start/prerequisites/). Depuis le dossier du projet, exécutez :

```
npm ci
npm run tauri dev
```

La préparation sélectionne automatiquement la dernière version stable publiée d’[Aède](https://craft-and-code.github.io/aede/), récupère ses dépendances verrouillées et compile le moteur intégré depuis cette source exacte. Elle nécessite le réseau pendant la préparation ; la compilation utilise ensuite les dépendances verrouillées hors ligne. Aucun dépôt voisin ni installation séparée d’Aède n’est nécessaire.

## Votre première bibliothèque

1. Ouvrez la roue crantée, puis Bibliothèques.
2. Activez le moteur local et choisissez un dossier musical.
3. Lancez explicitement le scan, puis attendez son résultat.
4. Ouvrez Albums, choisissez un disque et lancez sa lecture.

Commencez avec un petit dossier pour prendre vos repères. Le scan ne modifie ni les fichiers audio ni leurs tags. [Comprendre les bibliothèques](libraries.md) explique la différence entre scanner et synchroniser.

## Compléter votre collection

Une fois les disques visibles, poursuivez avec [le guide des dossiers](libraries.md), [les étapes pour récupérer pochettes, bannières et biographies](artists.md#recuperer-les-images-et-les-biographies), puis [la récupération des paroles](playback.md#recuperer-les-paroles). Le scan des fichiers et l’enrichissement en ligne sont deux actions distinctes.

## Trouver ses repères

Le panneau gauche choisit la vue. La recherche se trouve en haut. Le lecteur reste en bas, même quand vous changez de page. La roue crantée regroupe langue, apparence, navigation et lecture. Le compte n’est pas nécessaire pour écouter un CD ou une radio autorisée en mode invité.

## Utiliser une collection comme menu

Vous pouvez classer les collections disponibles avec leur poignée ou Alt+Haut/Bas avant de les ajouter. Cet ordre de préparation est conservé pendant la visite de Navigation pour le compte actif ; un groupe sélectionné est ajouté dans l’ordre affiché. Un seul trait vert indique la position d’insertion, dans cette liste comme lors de la copie d’une collection vers les menus.

Créez et enregistrez votre sélection depuis les filtres du catalogue ou la rubrique **Collections**. Dans **Paramètres → Navigation**, sélectionnez une ou plusieurs collections dans la liste de droite : **Maj+clic** ou **Maj+flèches/Début/Fin** sélectionne une plage, Ctrl/⌘+clic des lignes séparées et Ctrl+A/⌘A toute la liste. Ctrl/⌘+Maj ajoute une plage à la sélection existante. Cliquez ensuite sur **Ajouter au menu** (ou **Ajouter les N collections au menu**), ou appuyez sur Entrée. L’ajout groupé est enregistré en une fois : en cas de refus, les menus existants sont conservés. Un double-clic ajoute une collection ; vous pouvez aussi glisser une collection sur la ligne de menu souhaitée. Sur petit écran, la liste des collections passe sous l’organisation des menus. Chaque raccourci ouvre directement ses albums, d’après la règle enregistrée et évaluée par Aède. La recherche en haut réduit cette sélection.

Déplacez la nouvelle ligne avec sa poignée ou les flèches, renommez-la avec le crayon, ou masquez-la avec la case à cocher. La corbeille retire uniquement le raccourci du menu ; votre collection reste enregistrée. Les raccourcis appartiennent au compte et à la bibliothèque actifs. La collection et ses menus partagent un seul nom : renommer l’un actualise l’autre, y compris plusieurs raccourcis. La liste se recharge en revenant dans Navigation ; aucun bouton Actualiser distinct n’est nécessaire. Supprimer une collection rend ses anciens raccourcis indisponibles, même si une autre reprend son nom. Un moteur Aède compatible est nécessaire ; un ancien moteur affiche une demande de mise à jour et de redémarrage. Réinitialiser le menu retire ses raccourcis.

Dans **Paramètres → Bibliothèques → Dossiers exclus du scan**, Haut/Bas sélectionne une ligne. **Maj+clic** ou **Maj+flèches/Début/Fin** étend ou réduit une plage à partir de la première ligne choisie ; Ctrl/⌘+Maj ajoute la plage à la sélection. Lorsque cette liste a le focus, **Ctrl+A** (**⌘A sur Mac**) sélectionne tout ; Ctrl/⌘+clic ajoute ou retire une ligne de la sélection. Suppr/Retour arrière ou **−** retire les règles sélectionnées, sans supprimer de fichier audio. Un clic simple ou une flèche sans Maj revient à une sélection unique. Après le retrait, une ligne voisine reste sélectionnée pour poursuivre. Si un retrait échoue, le traitement s’arrête : les exclusions déjà retirées le restent, les autres restent sélectionnées avec le message d’erreur. Glissez les lignes ou utilisez Alt+Haut/Bas pour les classer une à une ; cet ordre est mémorisé localement et ne change pas le scan.

Le **catalogue d’albums** partagé propose le même en-tête et les mêmes présentations qu’Albums : ordre inversé, ajouts récents, taille des pochettes, vue en liste, grille et Cover Flow. Le bouton Grille se trouve entre Liste et Cover Flow. La taille des pochettes se règle en liste et en grille ; la réglette reste désactivée en Cover Flow. Sur les lignes étroites, la largeur des pochettes est limitée pour laisser de la place aux titres et aux boutons de lecture. Compilations propose aussi Cover Flow et conserve la grille par défaut. Chaque vue retrouve sa présentation pendant la session. La recherche et la remise à zéro des filtres restent dans la collection enregistrée ; chaque menu conserve ses propres filtres pour le compte et la bibliothèque actifs. La création d’une collection dérivée depuis cette vue est indisponible ; modifiez plutôt sa règle dans Collections.

Utilisez **Ajouter un espacement**, puis son crayon, pour lui donner un titre de groupe facultatif. Un espacement nommé apparaît comme BIBLIOTHÈQUE, sans icône et avec le même retrait à gauche. Effacez son nom pour retrouver un espace vide. Il reste déplaçable, masquable et supprimable.

## Diagnostic Aède

Si une erreur interne Aède apparaît, cliquez sur **Voir le diagnostic** dans le message. La fenêtre indique les opérations en échec et leur bibliothèque. Le journal conserve les 64 dernières erreurs des connexions en cours et les efface à leur déconnexion. Il ne contient pas les paramètres des requêtes ni le journal interne du serveur.

Si les données personnelles sont illisibles après une mise à jour, vérifiez la compatibilité du moteur Aède utilisé. Un ancien moteur peut afficher le catalogue tout en refusant les notes, préférences ou collections récentes. Utilisez un moteur compatible ; ne supprimez pas vos données et ne lancez pas de scan pour tenter un retour à une ancienne version.

## Démonstration dans le navigateur

Le bouton [Tester Phémios](../../demo/#/albums) ouvre une première édition Web sans installation. Elle contient dix morceaux de Scott Buckley et Chris Zabriskie sous licence libre CC BY 4.0, des pochettes de démonstration originales, Albums/Cover Flow, la liste de lecture et la lecture avec le DSP Aède partagé compilé en WebAssembly. Les crédits restent accessibles dans la navigation. **Paramètres → Bibliothèques → Réinitialiser la démonstration** remet à zéro ses réglages de présentation, sans supprimer de musique ni les réglages d’un compte réel.

Pour votre collection, l’interface Web et l’API Aède doivent être hébergées à la même adresse. Choisissez ensuite **Utiliser ma bibliothèque** dans Paramètres → Bibliothèques et connectez votre compte. Cette première version lit les fichiers originaux compatibles avec le navigateur, jusqu’à 64 Mio par titre, et demande une nouvelle connexion après rechargement. La démonstration publique ne peut pas accéder automatiquement aux dossiers ou au serveur Aède de votre réseau domestique. Les CD, périphériques, fondu/normalisation et l’écoute supervisée restent disponibles dans l’application desktop. Le guide technique `docs/design/web-client.md` explique la préparation, l’hébergement et les limites.

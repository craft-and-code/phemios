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

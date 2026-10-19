# Premiers pas

Phémios est l’application de bureau pour parcourir et écouter votre CDthèque. Aède, son moteur intégré, construit le catalogue. Vous pouvez aussi connecter un serveur Aède, ou combiner les deux bibliothèques.

## Essayer le projet

Phémios est en développement. Ce site ne propose pas encore d’installateur public. Le catalogue de composants permet de découvrir les commandes sans installation, compte ou bibliothèque personnelle : [ouvrir Storybook](../../components/index.html). Il s’agit de scénarios fictifs, sans lecture audio réelle.

Pour lancer les sources, installez Node.js 22.12+ dans la branche 22, Node.js 24 ou 26+, Rust 1.90+ et les [prérequis Tauri](https://v2.tauri.app/start/prerequisites/). Depuis le dossier du projet, exécutez :

```
npm ci
npm run tauri dev
```

La préparation nécessite le dépôt Aède voisin, ou un moteur compatible explicitement configuré. Les instructions de compilation du moteur appartiennent à [Aède](https://craft-and-code.github.io/aede/). Les dépendances Cargo doivent avoir été récupérées avant la préparation hors ligne.

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

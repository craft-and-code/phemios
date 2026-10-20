# Vos bibliothèques

Un catalogue commun rassemble vos sources locales et serveur. Quand les deux sont présentes, les étiquettes d’origine permettent de distinguer les éditions. Avec une seule source, cette distinction reste discrète.

## Ajouter des dossiers locaux

« Importer » votre musique signifie l’ajouter au catalogue : Phémios ne déplace ni ne recopie les morceaux.

1. Ouvrez la roue crantée, puis **Bibliothèques**.
2. Dans **Bibliothèque locale**, cliquez sur **Activer Aède local**.
3. Cliquez sur **Ajouter des dossiers…**, puis sélectionnez le dossier qui contient vos artistes et albums. Vous pouvez en ajouter plusieurs.
4. Cliquez sur **Analyser les dossiers** : ajouter le chemin seul ne lance pas le scan. Cette analyse découvre les fichiers ; ce n’est pas une analyse audio FlacCompagnon.
5. Attendez le résultat de la tâche, puis utilisez **Synchroniser le catalogue local** pour relire le catalogue si nécessaire.
6. Revenez dans **Albums** ou **Artistes** pour retrouver votre musique.

Après l’ajout de nouveaux morceaux sur disque, relancez Analyser les dossiers. Une simple synchronisation ne parcourt pas vos dossiers. Retirer une racine de la configuration ne supprime jamais ses fichiers. La gestion détaillée des racines et des exclusions est décrite dans le [manuel Aède](https://craft-and-code.github.io/aede/docs/fr/index.html).

Les images et paroles ne sont pas toutes fournies par le scan : poursuivez avec [la récupération des images et biographies](artists.md#recuperer-les-images-et-les-biographies) et [celle des paroles](playback.md#recuperer-les-paroles).

Un dossier réseau doit être monté par votre système. Vérifiez sa disponibilité avant de scanner ; Phémios ne monte pas les partages à votre place. Une source indisponible peut conserver ses entrées en cache sans être lisible.

## Connecter un serveur

Renseignez son adresse et connectez votre compte dans la section Serveur Aède. Le voyant indique la connexion. Pour une connexion à l’App serveur Aède, utilisez son profil de connexion exporté. [Le guide de l’App Aède](https://craft-and-code.github.io/aede/docs/fr/server/reference/desktop.html) explique son démarrage et le certificat local.

Dans l’App Aède, le démarrage du serveur et les changements de dossiers pendant son fonctionnement lancent un scan en arrière-plan. Attendez son résultat : Phémios détecte ensuite le nouveau catalogue automatiquement, sans changer de vue. Avec la CLI, utilisez les commandes de gestion des dossiers et de scan dans le répertoire de données du serveur connecté. Une commande avec `--no-scan` laisse volontairement le contenu en attente du prochain scan.

Pour un administrateur, **Dossiers fournis par Aède** affiche les racines du serveur en lecture seule. Modifiez les dossiers dans l’App Aède ou la CLI : Phémios ne conserve aucune seconde liste éditable. **Scanner les dossiers du serveur** permet de demander un nouveau scan des racines connues d’Aède. Le bouton d’actualisation relit uniquement leur liste.

Les mots de passe et clés de services ne sont pas inclus dans une sauvegarde de préférences. Les permissions du compte déterminent les actions disponibles.

## Scanner ou synchroniser ?

- **Scanner** inspecte les dossiers du moteur et découvre les fichiers ajoutés ou déplacés. Les dossiers distants restent configurés dans Aède.
- **Synchroniser la bibliothèque** relit le catalogue déjà construit par Aède et met à jour la copie de navigation de Phémios. Cette action ne découvre pas seule un nouvel album sur disque.
- **Actualiser les dossiers** relit leur configuration ; ce n’est pas un scan.

Après un ajout de fichiers, scannez la bonne source et attendez la fin de la tâche. Phémios vérifie toutes les cinq secondes les catalogues des sessions connectées et les recharge lorsqu’ils changent. Le rechargement manuel reste disponible en cas de besoin. La navigation hors ligne utilise le cache disponible ; elle ne rend pas un fichier distant accessible sans son serveur.

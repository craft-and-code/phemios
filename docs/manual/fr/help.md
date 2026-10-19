# Questions et dépannage

## Un album n’apparaît pas après synchronisation

Synchroniser relit le catalogue existant. Vérifiez la source et le montage du dossier, lancez un scan, attendez son résultat puis synchronisez. Dans l’App serveur Aède et dans Phémios, les profils de données peuvent être distincts : vérifiez l’adresse réellement utilisée. Tout afficher permet aussi de vérifier qu’un filtre ne masque pas l’album.

## Je vois une pochette mais la lecture est indisponible

L’image peut venir du cache alors que le serveur ou le dossier est inaccessible. Vérifiez connexion, origine de l’édition et disponibilité du fichier. Un album manquant suggéré dans une discographie n’est pas un fichier présent.

## Il manque des images ou une biographie

Vérifiez les clés et lancez l’enrichissement approprié dans Sources externes. Une identité externe ou un lien de fournisseur peut manquer. Le rafraîchissement d’une image absente ne doit pas être confondu avec un scan ou une mise à jour de l’application.

## Une radio ne démarre pas

Une fiche de station ne garantit pas un flux vivant et compatible. Essayez une autre station et vérifiez le filtre HTTPS. La recherche et l’écoute radio ne demandent pas de serveur Aède ; les favoris sont liés au compte. Le message d’erreur permet de distinguer une recherche expirée d’un flux interrompu.

## Les paroles ne suivent pas la musique

Seules des paroles horodatées peuvent se synchroniser. Utilisez les flèches pour un texte sans temps. Demandez explicitement une récupération si elle est proposée, puis consultez l’erreur éventuelle. La récupération LRCLIB ne demande pas de clé API. Phémios n’invente pas de temps de synchronisation.

## Où trouver davantage d’aide ?

Diagnostic expose les contrôles de bibliothèque fournis par le moteur. Statistiques décrit votre catalogue et peut exporter un CSV. L’Encyclopédie propose des fiches et des recherches Wikipédia ; ses articles enregistrés sont privés par compte. Les trophées déjà gagnés restent acquis.

Pour les commandes, comptes, formats ou erreurs serveur, consultez [Aède](https://craft-and-code.github.io/aede/docs/fr/index.html). Pour lire les mesures audio, consultez [FlacCompagnon](https://craft-and-code.github.io/FlacCompagnon/). Pour examiner l’interface sans modifier votre bibliothèque, ouvrez [Storybook](../../components/index.html). La [Rustdoc](../../rust/phemios_core/index.html) et les [contrats TypeScript](../../typescript/index.html) s’adressent aux développeurs.

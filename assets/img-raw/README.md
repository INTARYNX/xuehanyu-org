# Illustrations originales (avant traitement)

Copie **non retouchée** des images générées, telle que renvoyée par le
connecteur (`matrix_generate_image`, 1024×1024). Ces fichiers sont les
sources de `assets/img/hsk1/` et `assets/img/hsk2/`, qui en sont la version
normalisée (512×512 WebP, fond blanc nettoyé, contours regularisés).

## Organisation

    hsk1/       original de chaque mot de HSK 1
    hsk2/       original de chaque mot de HSK 2
    variants/   essais et variantes écartés (suffixes __A / __B), gardés
                pour mémoire : c'est là que se trouvent les anciennes
                versions des quatre couleurs avant unification du motif
                « tache de peinture »

## Ce qui manque

Les originaux de **67 mots sur 145** ne sont plus disponibles : ils ont été
produits avant que le connecteur ne conserve les fichiers dans le Drive, et
`scripts/generate_images.py` supprime le fichier brut après traitement
(lignes `os.remove(src)`). Seule la version normalisée subsiste dans
`assets/img/`.

Pour les retrouver, il faudrait régénérer ces mots — ou, si le défaut est
visible, repartir du fichier original ci-dessous au lieu de la version
nettoyée.

## Pourquoi cette branche

Les versions de `assets/img/` sont le produit du pipeline
(génération → `normalize_images.py` → `clean_images.py`). certains mots
présentent des défauts introduits par ce nettoyage (contours coupés,
cadres résiduels, sujets rognés). Cette branche permet de comparer le brut
et le traité, et de remplacer une illustration par son original sans
regénérer.

Branchement :

    git checkout raw-images

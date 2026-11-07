# Illustrations originales (branche `originaux`)

Ce dossier contient les **fichiers bruts tels que produits par le générateur
d'images**, sans aucune retouche. Ils sont archivés séparément des fichiers
utilisés par le quiz (`assets/img/hsk1/` et `assets/img/hsk2/`, en WebP 512×512).

## Pourquoi une branche à part

Les images publiées par le site ont été passées dans une chaîne de traitement
(recadrage, mise à l'échelle, conversion WebP, contrôle du fond blanc). Ce
traitement est ce qui rend le quiz léger et cohérent à l'écran, mais il perd
la qualité native : **1024×1024 en PNG/JPEG d'origine contre 512×512 en WebP**.

Cette branche conserve la source brute pour :
- pouvoir ré-encoder les images sans repayer de génération ;
- comparer une illustration avant/après correction ;
- réutiliser les fichiers dans un contexte qui exige le 1024 (fiches, impression).

## Contenu

| Niveau | Fichiers | Format |
|---|---|---|
| HSK 1 | 55 | PNG ou JPEG, 1024×1024 |
| HSK 2 | 13 | PNG ou JPEG, 1024×1024 |

Quand un mot a été généré plusieurs fois (première version écartonnée car
ambiguë, ou échec du connecteur), **c'est la version la plus ancienne qui est
conservée ici** — c'est-à-dire l'originale, pas la version corrigée.
Les versions corrigées sont elles dans la branche `main`.

## Provenance

`manifest.json` décrit chaque fichier : identifiant de nœud dans le Drive du
connecteur, horodatage de génération, format, dimensions, taille et SHA-256.
Il permet de vérifier qu'un fichier est bien celui d'origine.

Ces fichiers ont été récupérés depuis le Drive où le connecteur
`matrix_generate_image` archive chaque image générée. Aucune génération n'a
été refaite pour constituer cette branche : le crédit de génération n'a pas
été consommé.

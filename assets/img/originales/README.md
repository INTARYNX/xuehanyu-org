# Illustrations originales (branche `originaux`)

Ce dossier contient les **fichiers bruts tels que produits par le générateur
d'images**, sans aucune retouche. Ils sont archivés séparément des fichiers
utilisés par le site (`assets/img/hsk1/` et `assets/img/hsk2/`, en WebP 512×512).

## Pourquoi une branche à part

Les images publiées par le site ont été passées dans une chaîne de traitement
(recadrage sur le sujet, mise à l'échelle, conversion WebP, fond blanc pur).
C'est ce qui rend le quiz léger et cohérent à l'écran, mais la source est
perdue : **1024×1024 en PNG/JPEG d'origine contre 512×512 en WebP**.

Cette branche conserve la source brute pour :
- réencoder les images sans repayer de génération ;
- comparer les versions avant / après correction d'ambiguïté ;
- réutiliser les fichiers dans un contexte qui exige le 1024 (fiches, impression).

## Nommage des variantes

Un mot a parfois été généré plusieurs fois : première version écartonnée car
ambiguë, échec partiel du connecteur, ou correction après relecture. **Toutes
les versions sont conservées**, pas seulement la première.

| Fichier | Sens |
|---|---|
| `cha.png` | version 1 — l'originale |
| `cha__v2.jpg` | version 2 — la correction |
| `beizi__v3.png` | version 3 |

Le nom de base est le *slug* du mot, le suffixe `__vN` numérote les versions
dans l'ordre chronologique de génération. L'extension est celle d'origine
(PNG ou JPEG) : elle est conservée telle quelle, sans reconversion.

## Contenu

| Niveau | Mots | Fichiers (toutes versions) |
|---|---|---|
| HSK 1 | 55 | 92 |
| HSK 2 | 13 | 13 |
| **Total** | **68** | **105** |

29 mots ont plus d'une version ; 39 n'en ont qu'une.

## Provenance

`manifest.json` décrit **chaque fichier** : numéro de version, format,
dimensions, taille, SHA-256, identifiant de nœud dans le Drive du connecteur
et horodatage de génération.

Ces fichiers ont été récupérés depuis le Drive où le connecteur
`matrix_generate_image` archive chaque image générée. Aucune génération n'a
été refaite pour constituer cette branche : le crédit de génération n'a pas
été consommé.

## Complémentarité avec la branche `raw-images`

La branche `raw-images` archive les originaux de l'autre jeu de vocabulaire
(78 mots). Les deux listes ne se recoupent que sur un mot (`kafei`), et leur
union couvre exactement les 145 images publiées sur `main`.

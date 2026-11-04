# Dogtrails — cadrage technique et roadmap

Site : dogtrails.net · Auteur : Paul · Mis à jour le 4 novembre 2026

## En bref

Un site statique, chaleureux et sans compte, qui raconte d'où viennent les races de chiens à travers trois vues liées : un arbre génétique, une carte des origines et une frise du temps.

- **Colonne vertébrale scientifique :** l'arbre de Parker et al. (2017, 161 races, 23 clades), enrichi plus tard par Dog10K (321 races, 25 clades).
- **Préhistoire :** l'ADN ancien de Bergström et al. (2020), au moins cinq lignées il y a 11 000 ans.
- **Géographie :** pays d'origine via la FCI et Wikidata, fond de carte Natural Earth (domaine public).
- **Stack :** SvelteKit 2 + Svelte 5 en export statique, D3 pour les calculs, Scrollama pour le récit.
- **Règle d'or :** chaque lien affiché porte son niveau de preuve (génétique, historique, légende).
- **Langue :** anglais d'abord (public international), français ensuite, néerlandais en bonus.

## Décisions prises

| Sujet | Décision |
| --- | --- |
| Nom | Dogtrails, domaine dogtrails.net, avec un sous-titre explicite (« dog trails » est très utilisé pour les balades) |
| Framework | SvelteKit (pas Next.js) |
| Public | International, site en anglais d'abord |
| Croisés et chiens de village | Hors de l'arbre en v1, un chapitre dédié dans le récit |
| Rythme | Deux soirées par semaine, sans échéance ferme |

## Sources de données

| Couche | Source retenue | Ce qu'elle apporte | Licence / accès | Fiabilité |
| --- | --- | --- | --- | --- |
| Arbre génétique v1 | [Parker et al. 2017, Cell Reports](https://pmc.ncbi.nlm.nih.gov/articles/PMC5492993) | 161 races, 23 clades, cladogramme bootstrappé (1 346 chiens) | Article en accès libre ; arbre en supplément ; génotypes sur NCBI GEO (GSE90441, GSE83160, GSE70454, GSE96736) | Génétique, forte |
| Arbre génétique v2 | [Dog10K, Meadows et al. 2023, Genome Biology](https://pmc.ncbi.nlm.nih.gov/articles/PMC10426128) | 321 races, 25 clades, chiens de village, loups | Données publiques, pipeline ouvert | Génétique, forte |
| Préhistoire | [Bergström et al. 2020, Science](https://eprints.whiterose.ac.uk/168236/1/aba9572_revision2_1_.pdf) | 27 génomes anciens, 5 lignées vers 11 000 ans, liens avec les migrations humaines | Manuscrit accepté en accès libre | Génétique, forte mais grossière |
| Origines et classification | [Nomenclature FCI](https://fci.be/en/nomenclature/) + Wikidata (propriété P495, pays d'origine) | Groupes, sections, numéros de standard, pays « propriétaire » | Faits réutilisables ; ne pas copier les textes des standards | Administrative |
| Fond de carte | [Natural Earth](https://www.naturalearthdata.com/about/terms-of-use/) 1:50m | Pays, côtes, relief | Domaine public | Cartographique |
| Photos | [Wikimedia Commons](https://commons.wikimedia.org/wiki/Commons:Reusing_content_outside_Wikimedia) | Une photo par race | CC BY / BY-SA, attribution par fichier | À vérifier image par image |

**L'arbre de Parker.** Le supplément 5 de l'article est un fichier NEXUS contenant l'arbre complet, avec une feuille par chien (1 236 feuilles, nommées `ABREV_id`, par exemple `BEAG_12345`) et le bootstrap sur les nœuds internes. Le supplément 1 (xlsx) donne pour chaque race son nom, son abréviation et son clade. Les deux fichiers ont été récupérés et exploités (voir « Données déjà prêtes »).

**Origine ≠ cheminement.** La FCI rattache chaque race à un pays, souvent celui de première apparition. Le dalmatien illustre le piège : [origine en Dalmatie, développement en Angleterre](https://janedogs.com/dog-advice/breed-standards). Le modèle de données distingue donc `origin`, `development` et `routes`.

**Sources écartées.** Le jeu Stanford Dogs (derrière l'API Dog CEO) reprend des images ImageNet [réservées à un usage non commercial de recherche ou d'éducation](https://datasets.cms.waikato.ac.nz/ufdl/stanford-dogs/) : bien pour un prototype privé, pas pour un site public. Les compteurs de races des blogs se contredisent ; seul le chiffre publié par la FCI fait foi, relevé au moment du build.

**Comptes à jour.** La FCI reconnaît environ 360 races à titre définitif et continue d'en ajouter à titre provisoire (le Tatranský Durič, n° 377, le 11 février 2026). Un [export CSV non officiel](https://github.com/paiv/fci-breeds) de la nomenclature existe en plusieurs langues, utile comme point de départ.

## Principes de design

Le site doit ressembler à un carnet de naturaliste qu'on feuillette au chaud, pas à un tableau de bord scientifique.

- **Matière :** fond papier crème, encre brun-noir, grain léger. Un mode sombre « veillée » (bleu nuit, lueur ambrée) plutôt qu'un simple négatif.
- **Couleurs :** 23 clades, c'est trop pour l'œil. On regroupe en 7 ou 8 grandes familles colorées (bergers, lévriers, spitz, molosses, terriers, chiens de chasse, compagnie, anciens) ; le clade précis apparaît au survol. Palette testée pour le daltonisme.
- **Typographie :** une serif chaleureuse pour les titres et le récit, une sans-serif lisible pour les étiquettes. Deux familles maximum.
- **Illustrations :** silhouettes de chiens dessinées en trait, une par grande famille. Elles portent l'identité visuelle ; les photos restent dans les fiches.
- **Mouvement :** transitions douces à ressort, jamais plus de 600 ms. Tout respecte `prefers-reduced-motion`.
- **Confort d'usage :** une seule action principale par écran, retour toujours visible (« revenir à l'arbre entier »), état partageable dans l'URL.
- **Mobile d'abord pour le récit, desktop d'abord pour l'exploration.** Sur téléphone, les vues s'empilent : un graphique collant en haut, le texte qui défile dessous.
- **Accessibilité :** arbre navigable au clavier, contrastes AA, chaque visuel doublé d'un résumé textuel.
- **Honnêteté visible :** trait plein pour le prouvé génétiquement, tirets pour l'historique, pointillés pour la tradition orale. Une légende permanente explique ce code.

## Stack technique

SvelteKit 2 + Svelte 5 en site 100 % statique, avec D3 utilisé pour les calculs (layouts, projections, échelles) et Svelte pour le rendu SVG.

| Brique | Choix | Pourquoi |
| --- | --- | --- |
| Framework | SvelteKit 2.5x + Svelte 5.55 (runes), `adapter-static` | Transitions et ressorts natifs, réactivité fine pour trois vues liées, prérendu des ~360 fiches |
| Langage | TypeScript strict | — |
| Visualisation | Modules D3 v7 à la carte : `d3-hierarchy`, `d3-geo`, `d3-scale`, `d3-shape` | Calculs éprouvés, rendu laissé à Svelte (pas de conflit sur le DOM) ; ne pas installer le paquet `d3` complet |
| Projection carte | `geoEqualEarth` ou `geoNaturalEarth1` sur TopoJSON Natural Earth 1:50m | Rendu doux et lisible, fichier léger |
| Récit au scroll | [Scrollama 3](https://github.com/russellgoldenberg/scrollama/) | IntersectionObserver, motif « graphique collant » standard |
| Validation des données | Zod | Le build échoue si une race n'a pas de source |
| Pipeline de données | Scripts Node/TS (Wikidata SPARQL, fusion FCI) ; Python ponctuel pour l'arbre | Exécutés une fois, résultats versionnés en JSON |
| Hébergement | Cloudflare Pages ou Netlify, offre gratuite | Site statique, zéro serveur |
| Mesure d'audience | Plausible ou rien | Respect de la vie privée, pas de bannière cookies |

**Alternatives écartées.**

- **Next.js :** maîtrisé, mais React rend les animations SVG fines plus verbeuses, et ce projet n'a besoin d'aucun serveur.
- **Astro + îlots Svelte :** excellent pour un site de contenu, mais ici l'essentiel est une seule expérience interactive avec un état partagé, ce qu'Astro découpe mal.
- **Mapbox / MapLibre :** tuiles et zoom superflus pour une carte du monde stylisée ; le SVG garde la main sur l'esthétique.
- **Canvas ou WebGL :** inutile sous ~2 000 éléments. À envisager seulement pour les flux animés si les performances mobiles déçoivent.

## Architecture

Tout le travail lourd se fait au build : le navigateur ne charge que des JSON propres et validés, et un seul état partagé pilote les trois vues.

```
SOURCES                         AU BUILD                    DANS LE NAVIGATEUR
Arbre : Parker, Dog10K   ─┐
ADN ancien : Bergström   ─┤     Pipeline                    Récit Scrollama (un preset par chapitre)
Races : FCI + Wikidata   ─┼──▶  fetch-wikidata    ──▶ JSON        │
Carte : Natural Earth    ─┤     merge-fci             validés      ▼
Photos : Commons         ─┘     parse-tree            (breeds,   Store partagé (état + synchro URL)
                                fetch-credits          tree,       ├──▶ TreeView
                                validate (Zod)         clades,     ├──▶ MapView
                                                       lineages,   └──▶ TimelineView
                                                       routes,
                                                       images)
```

Les vues ne parlent jamais directement entre elles : elles lisent le store et y écrivent par des actions ; le récit ne fait qu'appliquer des presets.

### Modèle de données

| Fichier | Contenu | Champs clés |
| --- | --- | --- |
| `breeds.json` | Une entrée par race | `id`, noms EN/FR/NL, n° FCI, groupe et section FCI, `clade`, `family`, `origin` (ISO + coordonnées), `development`, `fixedAround` (année approximative), `image`, `sources[]` |
| `tree.json` | Arbre hiérarchique issu du NEXUS de Parker | `name`, `children`, `cladeId`, `support` (bootstrap) |
| `clades.json` | Les 23 clades et leur famille de couleur | `id`, `label`, `family`, `story` (court texte) |
| `lineages.json` | Lignées préhistoriques et sites archéologiques | `id`, `label`, `sites[]` (coordonnées, datation), `source` |
| `routes.json` | Cheminements entre lieux | `from`, `to`, `period`, `evidence` (`genetic` / `historical` / `oral`), `source` |
| `images.json` | Crédits photo | `file`, `author`, `license`, `url` |

Le champ `evidence` est obligatoire sur chaque route : c'est lui qui choisit le style du trait, et Zod refuse une route sans source.

### Pipeline

1. `fetch-wikidata` : requête SPARQL sur les races de chien (pays d'origine, libellés multilingues, image Commons).
2. `merge-fci` : fusion avec la nomenclature FCI par numéro de standard, puis table de correspondance manuelle pour les noms divergents.
3. `parse-tree` : lecture du NEXUS de Parker (supplément 5), regroupement des chiens par race (abréviation avant le `_`), rattachement aux `id` de races via la table du supplément 1. Point de départ : `prune_tree.py`.
4. `fetch-credits` : métadonnées de licence des images via l'API Commons.
5. `validate` : schémas Zod et contrôles croisés (chaque feuille de l'arbre existe dans `breeds.json`, chaque route a une source).

### Front

- **Un store central** (`$state` Svelte 5) : `selectedBreed`, `selectedClade`, `timeRange`, `mode` (récit ou exploration). Synchronisé avec l'URL (`?breed=beagle&t=1850`) pour partager une vue.
- **Trois vues** qui lisent ce store et n'écrivent que via des actions : `TreeView` (dendrogramme radial), `MapView` (origines et arcs), `TimelineView` (curseur et jalons).
- **Récit** : chaque chapitre Scrollama déclenche un `preset` d'état (clade mis en avant, période, zoom carte). Le récit et l'exploration partagent exactement les mêmes vues. Un chapitre est consacré aux croisés et chiens de village (la plupart des chiens du monde ne sont pas des chiens de race ; Dog10K inclut 309 chiens de village).
- **Routes** : `/` (récit), `/explore`, `/breed/[id]` (fiches prérendues), `/sources` (crédits générés depuis les JSON).
- **i18n** : anglais d'abord, français ensuite, néerlandais en bonus.

```
dogtrails/
  data/raw/          # extractions brutes, versionnées (dont les suppléments Parker)
  data/manual/       # correspondances de noms, routes
  scripts/           # pipeline (fetch, merge, parse, validate)
  src/lib/data/      # JSON générés + schémas Zod
  src/lib/state/     # store partagé + sync URL
  src/lib/views/     # TreeView, MapView, TimelineView
  src/lib/story/     # chapitres et presets
  src/routes/        # /, /explore, /breed/[id], /sources
```

## Données déjà prêtes

Fichiers livrés avec ce plan, à placer dans `data/` :

- `tree-30.json` : l'arbre de Parker réduit aux 30 races de l'échantillon (un chien par race), feuilles avec `id`, `name`, `clade`, nœuds avec `support`.
- `tree-30.nwk` : le même arbre en Newick, pour vérification.
- `sample-30.json` : les 30 races avec abréviation Parker, nom, clade et chien utilisé.
- `prune_tree.py` : le script qui génère ces fichiers à partir des suppléments 1 et 5.

Limites connues :

- Un seul chien par race. Le Xoloitzcuintle est éclaté entre deux clades dans l'article : le pipeline final devra regrouper tous les chiens d'une race (sous-arbre ou plus proche ancêtre commun).
- Les valeurs `support` viennent de l'arbre complet ; sur l'arbre réduit, elles ne mesurent pas exactement le regroupement affiché.
- Groupes et pays FCI de l'échantillon ci-dessous remplis sans vérification une à une : à valider par le pipeline.

## Échantillon de départ : 30 races

Les 23 clades de Parker 2017 sont couverts par leur race représentante (figure 2 de l'article), plus 7 races choisies pour leur histoire. Les clades des 30 races sont confirmés par la table du supplément 1 et l'arbre du supplément 5.

| Race | Abrév. Parker | Clade Parker 2017 | Groupe FCI | Pays d'origine (FCI) | Pourquoi elle est là |
| --- | --- | --- | --- | --- | --- |
| Akita | AKIT | Asian Spitz | 5 | Japon | Clade parmi les plus anciens |
| Chow Chow | CHOW | Asian Spitz | 5 | Chine | Ancêtre de croisements récents (Eurasier) |
| Shih Tzu | SHIH | Asian Toy | 9 | Tibet | Clade très métissé |
| Pug (carlin) | PUG | Toy Spitz | 9 | Chine | Exporté d'Asie, a nourri beaucoup de petites races |
| Brussels Griffon | BRUS | Toy Spitz | 9 | Belgique | Représentant du clade |
| Pomeranian | POM | Small Spitz | 5 | Allemagne | Représentant du clade |
| Icelandic Sheepdog | ICES | Nordic Spitz | 5 | Islande | Représentant du clade |
| Miniature Schnauzer | MSNZ | Schnauzer | 2 | Allemagne | Représentant du clade |
| Miniature Pinscher | MPIN | Pinscher | 2 | Allemagne | Représentant du clade |
| Puli | PULI | Hungarian | 1 | Hongrie | Représentant du clade |
| Standard Poodle | SPOO | Poodle | 9 | France | Représentant du clade |
| Chihuahua | CHIH | American Toy | 9 | Mexique | Signature possible des chiens américains d'avant Colomb |
| Chinese Crested | CRES | American Toy | 9 | Chine | Nom asiatique, origine génétique américaine |
| Rat Terrier | RATT | American Terrier | non reconnu | États-Unis | Descend des feists, chiens de chasse locaux |
| Irish Terrier | IRIT | Terrier | 3 | Irlande | Représentant du clade |
| German Shepherd | GSD | New World | 1 | Allemagne | Au cœur des métissages du clade New World |
| Xoloitzcuintle | XOLO | New World | 5 | Mexique | Race ancienne, éclatée entre deux clades |
| Saluki | SALU | Mediterranean | 10 | Moyen-Orient | Clade parmi les plus anciens |
| Basset Hound | BASS | Scent Hound | 6 | Royaume-Uni | Représentant du clade |
| Beagle | BEAG | Scent Hound | 6 | Royaume-Uni | Le chien de la maison |
| American Cocker Spaniel | ACKR | Spaniel | 8 | États-Unis | Représentant du clade |
| Golden Retriever | GOLD | Retriever | 8 | Royaume-Uni | Séparation datée par la génétique (vers 1895) |
| Nova Scotia Duck Tolling Retriever | NSDT | Retriever | 8 | Canada | Ancêtres collies cachés révélés par l'ADN |
| German Shorthaired Pointer | GSHP | Pointer Setter | 7 | Allemagne | Représentant du clade |
| Briard | BRIA | Continental Herder | 1 | France | Représentant du clade |
| Shetland Sheepdog | SSHP | UK Rural | 1 | Royaume-Uni | Représentant du clade |
| Border Collie | BORD | UK Rural | 1 | Royaume-Uni | Bergers britanniques, lien avec le Nova Scotia |
| Rottweiler | ROTT | Drover | 2 | Allemagne | Représentant du clade |
| Saint Bernard | STBD | Alpine | 2 | Suisse | Représentant du clade |
| English Mastiff | MAST | European Mastiff | 2 | Royaume-Uni | Gigantisme apparu indépendamment des gardiens de troupeaux |

## Roadmap

Six phases sans dates ; chacune se termine par une porte claire, et la phase 2 suffit déjà à publier quelque chose de beau. Rythme : deux soirées par semaine, soit 3 à 4 semaines jusqu'à la phase 2, puis une à deux semaines par phase. Rien ne casse si une phase dure le double.

| Phase | Contenu | Porte de sortie |
| --- | --- | --- |
| 0 · Socle de données | Arbre Parker rattaché (fait pour 30 races), table de correspondance des noms, pipeline Wikidata + FCI, toute la chaîne testée sur 30 races | JSON validés par Zod, 30 races complètes et sourcées |
| 1 · Design (Claude Design) | Design system : familles de couleurs, typographies, styles de trait par niveau de preuve. Maquettes : récit, vue combinée desktop et mobile, fiche race | Maquettes validées par Paul |
| 2 · L'arbre, première mise en ligne | TreeView radial des 161 races : survol, sélection, fiches `/breed` prérendues, page `/sources` générée, déploiement statique | v0.1 en ligne, partageable |
| 3 · La carte | MapView : origines, pays de développement, routes tracées selon leur niveau de preuve ; un clade choisi dans l'arbre s'allume sur la carte, et inversement | Arbre et carte synchronisés par l'URL |
| 4 · La frise et le récit | TimelineView : lignées préhistoriques, puis l'explosion des races au XIXe siècle ; chapitres Scrollama qui pilotent les trois vues, dont le chapitre croisés et chiens de village | Lancement de la v1 |
| 5 · Bonus, sans échéance | Passage à Dog10K (321 races), versions française et néerlandaise, réutilisation des données pour DogGuessr | — |

## Travail avec Claude Code

- Ce document sert de spécification ; le design system exporté de Claude Design (tokens CSS) viendra le compléter.
- Créer un `CLAUDE.md` court : stack figée, conventions (Svelte 5 runes, TypeScript strict), règle « aucune donnée sans source », commandes du pipeline.
- Une tâche par session, alignée sur la roadmap, relue et validée avant la suivante. Première tâche suggérée : squelette SvelteKit + `adapter-static`, dossier `data/` avec les fichiers déjà prêts, puis portage de `prune_tree.py` en script `parse-tree` qui regroupe tous les chiens d'une race.
- La table de correspondance des noms reste un travail humain, ou assisté mais relu par Paul : c'est là que se nichent les erreurs qui comptent.

## Risques

| Risque | Effet | Parade |
| --- | --- | --- |
| Noms de races divergents entre Parker, FCI et Wikidata | Feuilles de l'arbre orphelines | Table de correspondance manuelle + contrôle au build |
| Une race éclatée entre clades (Xoloitzcuintle) | Position ambiguë dans l'arbre | Regrouper tous les chiens de la race ; comparaison avec Dog10K plus tard |
| Routes historiques peu sourcées | Le site affirme des légendes | Champ `evidence` obligatoire, style de trait dédié |
| Frontières contestées sur la carte | Polémique inutile | Natural Earth trace les frontières de facto ; rester au niveau pays |
| Licences photo mal reprises | Retrait demandé | Crédits générés automatiquement depuis l'API Commons |
| Périmètre qui gonfle | Projet jamais publié | Lancer avec l'arbre seul ; carte et récit en versions suivantes |

## Sources

- [Parker et al. 2017, Cell Reports (PMC)](https://pmc.ncbi.nlm.nih.gov/articles/PMC5492993) — suppléments 1 (table des races) et 5 (arbre NEXUS)
- [Meadows et al. 2023, Dog10K, Genome Biology (PMC)](https://pmc.ncbi.nlm.nih.gov/articles/PMC10426128)
- [Bergström et al. 2020, Science (manuscrit accepté)](https://eprints.whiterose.ac.uk/168236/1/aba9572_revision2_1_.pdf)
- [Nomenclature FCI](https://fci.be/en/nomenclature/)
- [fci-breeds, export CSV non officiel](https://github.com/paiv/fci-breeds)
- [Natural Earth, conditions d'utilisation](https://www.naturalearthdata.com/about/terms-of-use/)
- [Wikimedia Commons, réutilisation hors Wikimedia](https://commons.wikimedia.org/wiki/Commons:Reusing_content_outside_Wikimedia)
- [Stanford Dogs, conditions ImageNet](https://datasets.cms.waikato.ac.nz/ufdl/stanford-dogs/)
- [Scrollama](https://github.com/russellgoldenberg/scrollama/)
- [Jane Dogs, pays d'origine et de développement](https://janedogs.com/dog-advice/breed-standards)

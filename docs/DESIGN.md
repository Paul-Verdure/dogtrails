# Dogtrails — système visuel B+

« Un atlas des étoiles qu'on lit à la lanterne. » Validé par Paul le 4 novembre 2026.
Maquettes de référence : canevas Claude Design « Dogtrails » (rangées *Design system* et *Screens — B+*).
Tokens : `src/lib/styles/tokens.css` (préfixe `--dt-`). Projections : `src/lib/map/projections.ts`.

## 1. Deux modes, une règle

Ce qui compte est vivant, le reste se retire.

| | Nuit (défaut du récit) | Jour |
| --- | --- | --- |
| Fond | `#0C1424` bleu nuit | `#F4EEE3` papier |
| Encre | `#F1E6D2` crème | `#14223A` bleu nuit (la nuit devient l'encre) |
| Accent | lanterne `#F3B867` | soleil `#E8A048` en aplat, texte `#8A4F08` |
| Focus | flaque de lumière ambrée, le reste dans l'ombre (`--dt-rest-veil`) | soleil bas ambré, le reste pâlit vers le papier |
| Étoiles | lumineuses, flou derrière, sans contour | imprimées, contour d'encre 0,7 px, sans flou |

Choix du mode : `data-theme="night|day"` sur `<html>`. Par défaut, préférence système, sauf pour le récit qui s'ouvre de nuit. Le choix du visiteur est mémorisé (localStorage, try/catch).

## 2. Les 8 familles

Couleurs testées : ≥ 3:1 sur papier, ≥ 5:1 de nuit. Écart perceptuel (CAM02-UCS) ≥ 8,7 entre toutes les paires sous deutéranomalie, protanomalie et tritanomalie.

| Famille | id | Nuit | Jour | Constellation |
| --- | --- | --- | --- | --- |
| Herding | `herding` | `#5A86CF` | `#24477F` | the Crook |
| Sighthounds | `sighthound` | `#F2C14E` | `#B07C00` | the Runner |
| Spitz | `spitz` | `#A6E0F0` | `#2F80B8` | the Curled Tail |
| Mastiffs | `mastiff` | `#D95F6E` | `#8A2435` | the Gate |
| Terriers | `terrier` | `#5FC79E` | `#1E7A55` | the Burrow |
| Hunting dogs | `hunting` | `#F08A4B` | `#A9411A` | the Scent |
| Companions | `companion` | `#E88DC4` | `#B0408A` | the Lap |
| Ancient | `ancient` | `#B9A0F4` | `#6A4FB0` | the First Fire |

La couleur ne porte jamais seule le sens : l'étiquette, l'emblème ou le motif du trait l'accompagnent toujours.

### Attribution des 30 races de l'échantillon

La famille se définit par race, pas par clade (le clade New World contient un berger et une race ancienne).

| Famille | Races (abrév. Parker) |
| --- | --- |
| herding | PULI, GSD, BRIA, SSHP, BORD |
| sighthound | SALU |
| spitz | POM, ICES |
| mastiff | ROTT, STBD, MAST |
| terrier | MSNZ, MPIN, RATT, IRIT |
| hunting | BASS, BEAG, ACKR, GOLD, NSDT, GSHP |
| companion | SHIH, PUG, BRUS, SPOO, CHIH, CRES |
| ancient | AKIT, CHOW, XOLO |

À valider par Paul quand on passera aux 161 races. C'est un choix éditorial, pas une donnée.

### Emblèmes (viewBox 0 0 120 90, trait 1 px à 55 % d'opacité, étoiles 0,45, la plus brillante 0,65)

```
herding     polyline 25,75 25,35 40,18* 60,22 66,38
sighthound  polyline 10,60 40,50 75,47 108,52 + 75,47 86,30*
spitz       polyline 22,75 44,60 70,55 86,40 77,22* 60,30
mastiff     polygon  32,25 86,25 92,68* 26,68
terrier     polyline 15,62 36,30 57,62* 78,30 99,62
hunting     polyline 14,66 54,48 104,30* + 54,48 60,74
companion   polygon  60,22* 80,38 72,62 48,62 40,38
ancient     polygon  20,68 60,16* 100,68 + étoile faible 60,50 (0,3)
```
(`*` = étoile la plus brillante)

Les constellations n'apparaissent **jamais** sous forme de lignes sur la carte : elles seraient confondues avec des routes. On les réserve aux légendes, aux filtres, aux fiches et aux pastilles.

## 3. L'étoile

- Tracé de 20 × 20 centré sur (0,0) : `M0,-10L2.2,-2.2L10,0L2.2,2.2L0,10L-2.2,2.2L-10,0L-2.2,-2.2Z`.
- Échelle sur la carte : 0,62 en zone dégagée, 0,42 en zone dense (Europe). Arbre : 0,55 au repos, 0,65 allumée (Paul, 2026-11-05 : branches colorées par famille, les étoiles à 0,45 se perdaient). Zone cliquable de 44 px dans tous les cas.
- Quatre états :
  - **repos** : couleur de famille.
  - **allumée** (survol ou famille sélectionnée) : légèrement plus grande, avec un flou de nuit.
  - **choisie** : garde sa couleur de famille, avec un halo ambré flouté et un anneau pointillé `1 3` ; de jour, l'anneau est ambre `#B4690E` sur un disque ambré à 20 %.
  - **dans l'ombre** : `#6F7D93` à 40 % la nuit, la couleur de famille à 30 % le jour.
- La taille ne code aucune donnée.

## 4. Les trois traits (niveaux de preuve)

| evidence | Nom affiché | Terme clair | Motif | Couleur nuit / jour |
| --- | --- | --- | --- | --- |
| `genetic` | **In the blood** | genetic | plein, 2 px | encre `#F1E6D2` / `#14223A` |
| `historical` | **On paper** | historical | tirets `7 5` | ambre `#F3B867` / `#B4690E` |
| `oral` | **By the fire** | oral tradition | points `0.1 5.5`, extrémités rondes, 2,4 px | `#C9D1DE` / `#4A5A75` |

- Le nom poétique est toujours accompagné du terme clair (légende, fiches, tooltips).
- Légende permanente sur la carte, version compacte en pastilles sur mobile et dans la barre d'outils de l'explorateur, et une fenêtre « Why three kinds? » avec un exemple réel par niveau.

## 5. La lanterne

- Implémentation : un calque `pointer-events: none` au-dessus de la carte, fait de deux `radial-gradient` (lueur ambrée au centre, puis `--dt-rest-veil` à l'extérieur). Centre et rayon viennent du store (sélection ou preset de chapitre).
- Déplacement : 600 ms, `--dt-ease`. Saut instantané si le visiteur demande moins d'animations.
- La même logique s'applique dans l'arbre (branche allumée, reste à 30 %) et sur la frise (curseur-lanterne).

## 6. Fond de carte gravé

Généré par `scripts/make-maps.ts` (`npm run maps`) à partir de Natural Earth (domaine public) :
- **Monde** : `geoEqualEarth().rotate([-10, 0])`, terres au 1:110m.
- **Régional** (ex. Atlantique Nord) : `geoConicEqualArea`, 1:50m, découpé au cadre.
- **Terres** : aplat, puis hachures (motif 3,2 px tourné de 35°), puis trait de côte.
- **Lignes d'eau** : trois tracés de la côte, en 18, 12 et 7 px, à 5, 8 et 12 % d'opacité.
- **Graticule** : 15° pour le monde, 10° pour le régional, en pointillés `1 3`.
- Une version nuit et une version jour, couleurs dans le script.

Les étoiles et les routes sont dessinées par Svelte par-dessus, dans le même viewBox (1000 × 500 pour le monde), avec les mêmes projections.

## 7. Typographie

- **Instrument Serif** (400, italique) : titres, récit, noms de lieux (toujours en italique, comme sur un atlas), noms des niveaux de preuve.
- **DM Sans** (400/500/600) : données, étiquettes, interface.
- Échelle :

| Niveau | Taille | Interlignage |
| --- | --- | --- |
| Display | 48–104 | .95 |
| H1 | 64 | — |
| H2 | 40 | — |
| H3 | 26 | — |
| Chapô | 19 | 1.6 |
| Corps | 16 | 1.6 |
| Petit | 14 | — |
| Étiquette | 12 | capitales, approche .18em, 600 |

- La voix d'atlas : les chapitres sont des **Plates** (I à V), les coordonnées sont en chiffres tabulaires (`51°45′ N · 0°30′ E`), et le bouton principal du récit s'appelle « Light the lantern ».

## 8. Espace, rayons, mouvement

- **Espacements** : base 4 (4, 8, 12, 16, 24, 32, 48, 64, 96). Gouttière mobile 16 px.
- **Rayons** : 6 (légende), 10 (cartes, panneaux), 14 (cadres de carte, photos), pilule (boutons, pastilles).
- **Mouvement** :
  - 160 ms : survol, focus, étoile allumée.
  - 320 ms : cartes, tooltips, bascule nuit/jour.
  - 600 ms maximum : lanterne, réorganisation de l'arbre et de la carte.
  - Courbe `cubic-bezier(.22, 1, .36, 1)`.

## 9. Écrans de référence

1. **Accueil du récit** (Plate I), nuit et jour : titre display, carte gravée plein cadre, 30 étoiles, trois routes d'exemple, légende, barre des cinq Plates.
2. **Explorateur desktop** : arbre à gauche, carte à droite, frise sur toute la largeur. Bandeau de sélection (famille, race, année), recherche, « Copy link to this view », carte de race flottante.
3. **Récit mobile** (Plate III) : carte collante de 300 px sous la barre de chapitre, cartes de texte qui défilent dessous, chaque paragraphe avec son niveau de preuve.
4. **Fiche race** (Beagle), nuit et jour : emblème de famille, faits FCI, emplacement photo avec crédit, carte régionale, trois cartes de preuve, parents en étoiles, sources.
5. **Légende des preuves** : complète, compacte, et fenêtre explicative.

## 10. Faits à sourcer avant publication

Utilisés dans les maquettes car souvent cités, mais **non vérifiés** :
- Meute Honeywood, Essex, années 1830.
- Importations de Beagles dans l'Illinois, années 1870.
- Carlins arrivés en Europe par les Hollandais au XVIe siècle.
- Légende de Guillaume d'Orange et du carlin (1572).
- Légende des chiens normands de 1066.
- Golden Retriever 1868, Kennel Club 1873, Berger allemand 1899.
- Beagle : standard FCI n° 161, 33–40 cm.
- « 19 des 30 races viennent d'Europe » : compté d'après les pays FCI de l'échantillon, à recompter par le pipeline.

L'ordre des branches de l'arbre dans les maquettes est schématique ; le vrai vient de `tree-30.json` / Parker.

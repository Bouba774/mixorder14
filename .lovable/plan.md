# Playlist zone + détection ligne bleue active

## Objectif

Remplacer la calibration "première ligne playlist" (`nameZoneDeck1/2`) par une calibration **zone complète de la liste des morceaux** (`playlistZoneDeck1/2`). Le robot capture cette zone, détecte automatiquement la ligne active (fond bleu ~#2A6FDB, tolérance HSV large), isole cette ligne, puis OCR uniquement dessus.

## Périmètre

### 1. Modèle de calibration — `src/lib/analysis/discdj-settings.ts`
- Remplacer `nameZoneDeck1` / `nameZoneDeck2` par `playlistZoneDeck1` / `playlistZoneDeck2` dans `DiscDJCalibration`, `CalibrationTarget`, `CALIBRATION_SCREEN`, `isRectTarget`, `normalizeCalibration`.
- Nouveau storage key `mixorder:discdj-robot:settings:v5` → les anciennes calibrations `nameZone*` sont invalidées (l'utilisateur recalibre une seule fois). Les autres réglages (BPM, Next, Playlist, Back) restent conservés via merge à partir des defaults.

### 2. Bridge — `src/lib/analysis/discdj-bridge.ts`
- Renommer `nameZone` → `playlistZone` dans `BackgroundRunOptions` et `calibrationInstruction`.
- Nouvelle `DiscDJReading` (ou méthode dédiée) : ajouter un mode `readActiveTrackName({ deck, playlistZone })` qui renvoie `{ name, croppedFullZone, croppedActiveLine, rowRect, matched, reason }` pour l'OCR ciblé et le mode test.

### 3. Plugin natif Android
- `DiscDJRobotPlugin.java` : nouvelle méthode `readPlaylistActiveName({ deck, playlistZone })` — capture screenshot, crop zone playlist, appelle `PlaylistRowDetector.findActiveRow(bitmap)`, crop la ligne détectée, OCR (réutilise le pipeline existant), renvoie `{ name, rowRect, fullZoneImage (base64), activeRowImage (base64), detectionReason }`.
- Nouvelle classe `PlaylistRowDetector.java` : scan ligne par ligne, ratio de pixels bleus par ligne (HSV : H ∈ [200°, 230°], S ≥ 0.35, V ∈ [0.30, 0.90]), retient les runs contigus de lignes bleues au-dessus d'un seuil (≥25 %), renvoie le rectangle de la plus longue bande. Renvoie `null` si aucune bande crédible.
- `DiscDJAccessibilityService.java` : ajouter un helper `cropCanonicalRect(rect)` → Bitmap si absent, réutilisable.
- Manifeste `AndroidManifest.xml` : rien de neuf (pas de permission).
- `mixorder-discdj-robot/src/index.d.ts` : ajouter `readPlaylistActiveName`.

### 4. Logique robot — `src/lib/analysis/discdj-robot.ts`
- Mode `autosync-name` : remplacer l'appel `readBpm` en écran playlist (qui lisait `nameZone`) par `readPlaylistActiveName({ playlistZone })`.
- Si `name === null` avec `reason === "no-active-row"` → arrêter le run avec message clair : « Ligne active DiscDJ introuvable — recalibre la zone playlist. »
- Retry OCR (`nameMaxOcrRetries`) inchangé, mais seulement sur l'étape OCR de la ligne isolée, pas sur la détection ligne bleue (qui est déterministe).

### 5. Panneau UI — `src/components/mixorder/DiscDJRobotPanel.tsx`
- Enlever les entrées de calibration `nameZoneDeck1/2`, ajouter `playlistZoneDeck1/2` (rectangle, écran playlist). Libellé : « Zone complète playlist — deck 1 / 2 ».
- Bouton **Tester la zone playlist** amélioré : appelle `readPlaylistActiveName`, affiche :
  - la zone captée entière (image),
  - un rectangle vert par-dessus indiquant la ligne bleue détectée,
  - le texte OCR final,
  - un badge d'état (`détectée` / `aucune ligne bleue` / `OCR vide`).

## Détails techniques

**Détection bleu (HSV) — pseudo-code Java :**
```
for each row y in croppedZone:
    bluePixels = 0
    for each x: if isDiscDJBlue(pixel[x,y]) bluePixels++
    ratio[y] = bluePixels / width
runs = contiguous y where ratio[y] > 0.25
active = longest run with length in [minRowHeightPx, maxRowHeightPx]
```
Plage HSV : `hue ∈ [200, 230]`, `sat ≥ 0.35`, `val ∈ [0.30, 0.92]` (couvre le bleu DiscDJ standard + variantes légères de skin).

**Migration :** l'ancien key v4 n'est pas lu. `savedAt`, waits et modes sont réappliqués via `normalizeSettings` sur un objet vide → l'utilisateur voit une calibration "playlist zone" vierge à recalibrer, tout le reste (Next, BPM, Playlist button, Back) demeure sur son défaut. Pas de migration transparente demandée par l'utilisateur.

**Pas touché :** logique de matching (`matching.ts`), rendu bibliothèque, autres onglets, thème.

## Livraison

Un rapport résumé listant fichiers modifiés + demande explicite à l'utilisateur de recalibrer une fois `playlistZoneDeck1` et `playlistZoneDeck2` dans DiscDJ.

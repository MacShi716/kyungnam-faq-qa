# Third-party notices

## OpenStreetMap — ODbL 1.0
`osm-buildings.json` contains OSM-derived horizontal geometry, IDs and tags only.
© OpenStreetMap contributors
https://www.openstreetmap.org/copyright
https://opendatacommons.org/licenses/odbl/1-0/
Keep clickable attribution visible on the map. Preserve applicable ODbL share-alike, attribution and database/source-access obligations when distributing this derived database. FAQ links are separately held in campus-poi-directory.json.

## Copernicus WorldDEM-30
`assets/map/campus-terrain.json` contains Copernicus GLO-30 data only, under the accompanying `assets/map/COPERNICUS-LICENSE.txt` (kept in the same directory as `assets/map/DEM-NOTICE.txt`). This data is explicitly excluded from any MIT code license. This repository has no root MIT `LICENSE` that covers those DEM files; Copernicus WorldDEM-30 Article 6 governs them.

Article 6 downstream obligations: retain source attribution and the adapted-data notice, communicate the liability disclaimer, do not imply endorsement, and bind subsequent distributors/communicators to the same obligations. The full license governs. No EU/ESA/DLR/Airbus logos are included or authorized by this pack.

### Article 6(a) source attribution
© DLR e.V. 2010-2014 and © Airbus Defence and Space GmbH 2014-2018 provided under COPERNICUS by the European Union and ESA; all rights reserved.

### Article 6(b) adapted-data attribution and 6(c) disclaimer
produced using Copernicus WorldDEM-30 © DLR e.V. 2010-2014 and © Airbus Defence and Space GmbH 2014-2018 provided under COPERNICUS by the European Union and ESA; all rights reserved.

The organisations in charge of the Copernicus programme by law or by delegation do not incur any liability for any use of the Copernicus WorldDEM-30.

Redistribution must preserve the obligations in Article 6 of the accompanying COPERNICUS-LICENSE.txt in this directory. No endorsement is implied.

Geometry, DEM and FAQ metadata are physically separated; runtime joins do not constitute a legal opinion about database licensing. Do not commit generated cross-source elevation-enriched building databases to the OSM data file.

## Three.js 0.187.0 — MIT
Runtime is bundled locally as `assets/map/campus-map.min.js` from the exact package `three@0.187.0` (tree-shaken with OrbitControls; no CDN). Full license copied verbatim to `assets/map/THREE-LICENSE.txt` and below.

```text
The MIT License

Copyright © 2010-2026 three.js authors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.

```

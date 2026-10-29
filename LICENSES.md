# Licences

Everything in `site/` that is not listed here was written for this project — including the
generated white marble and timber cladding textures (`tools/prep-textures.py`; the cladding is made from the CC0 oak_veneer_01), the abstract art, painted in code
(`site/js/three/art.js`), the flames (`site/js/three/fire.js`) and the sky (a shader).

## Libraries in the website (`site/vendor/three/`, copied from npm by `tools/vendor-three.mjs`)

The site loads nothing from other servers. These files are copied unchanged from the npm
package `three@0.186.1`; its licence file is at `site/vendor/three/LICENSE`.

| What | Licence | How it is used |
|---|---|---|
| three.js 0.186.1 (core, GLTFLoader, DRACOLoader, KTX2Loader and their helpers) | MIT, © 2010–2026 three.js authors | WebGL rendering, model and texture loading |
| Draco decoder (`libs/draco/gltf/`) | Apache 2.0, © Google | Decompresses the model geometry |
| Basis Universal transcoder (`libs/basis/`) | Apache 2.0, © Binomial LLC | Turns the KTX2 textures into the GPU's own format (BC7, ASTC, ETC) |
| ktx-parse, zstddec (`libs/`) | MIT, © Don McCurdy (zstddec includes Zstandard, BSD, © Meta) | Read KTX2 files, unpack their zstd layer |

## Build tools (npm, local to this folder, not part of the website)

Installed with `npm install` into `node_modules/` (dev dependencies in `package.json`); nothing
is installed on the system.

| Package | Licence | Used for |
|---|---|---|
| ktx2-encoder 0.6.0 (Basis Universal encoder compiled to WebAssembly) | MIT (encoder: Apache 2.0, © Binomial LLC) | `tools/compress.mjs`: JPEG / PNG → KTX2 |
| @gltf-transform/core, extensions, functions 4.5.1 | MIT, © Don McCurdy | `tools/compress.mjs`: re-writes the models with KTX2 textures inside |
| draco3dgltf 1.5.7 | Apache 2.0, © Google | Reads and writes the Draco geometry while doing so |
| jpeg-js 0.4.4, pngjs 7.0.0 | BSD-3-Clause, MIT | Decode the source images for the encoder |
| three 0.186.1 | MIT | Source of `site/vendor/three/` |

## Poly Haven assets (all CC0 — https://polyhaven.com/license)

Downloaded on 19.10.2026 after approval of `bake/ASSETS-PROPOSED.md` and
`bake/ASSETS-PROPOSED-TREES.md`. Originals are kept in `assets-src/polyhaven/` (not part of the
website); the website gets resized, re-encoded or reduced versions.

### Textures → `site/textures/` (KTX2, from 2K / 1K JPEG, colour scaled to the house palette)

| Asset | Page | Used for |
|---|---|---|
| oak_wood_planks | https://polyhaven.com/a/oak_wood_planks | Oak floors (living, bedrooms, office, gallery, walk-in) |
| oak_veneer_01 | https://polyhaven.com/a/oak_veneer_01 | Light oak furniture and joinery, teak tone outside |
| smoked_walnut_veneer | https://polyhaven.com/a/smoked_walnut_veneer | Walnut kitchen, shelves, sideboard, garage door |
| marble_01 | https://polyhaven.com/a/marble_01 | Travertine: hall and bathroom floors, shower walls, terrace paving, coffee table (it is a honed beige limestone tile) |
| white_plaster_02 | https://polyhaven.com/a/white_plaster_02 | Lime plaster walls and ceilings (contrast reduced) |
| white_stucco | https://polyhaven.com/a/white_stucco | Exterior lime render |
| rough_linen | https://polyhaven.com/a/rough_linen | Linen weave (relief) on upholstery, bedding, cushions, throws, clothes |
| poly_wool_herringbone | https://polyhaven.com/a/poly_wool_herringbone | Wool rugs, towels |
| brushed_concrete | https://polyhaven.com/a/brushed_concrete | Garage floor, driveway, pavements |
| gravel | https://polyhaven.com/a/gravel | Gravel strip along the facades, roof ballast |
| leafy_grass | https://polyhaven.com/a/leafy_grass | Lawn |
| interior_tiles | https://polyhaven.com/a/interior_tiles | Pool lining (turned 45°, tinted) |

Derived textures, made from the CC0 assets above by `tools/blender/make-hedge.py`: the clipped hedge
surface (`textures/hedge/`) and the leaf spray on its edges (`textures/hedgeLeaf/`) are renders of
the island_tree_02 leaves; the pool's ripple relief (`textures/water/`) is generated in code.

### Models → `site/models/decor-<room>.glb`, `trees.glb`, `trees-light.glb` (light baked per vertex)

| Asset | Page | Used for |
|---|---|---|
| island_tree_02 | https://polyhaven.com/a/island_tree_02 | Olive-like garden trees by the pool, the terrace and the drive (leaves turned into cards, branches reduced) |
| tree_small_02 | https://polyhaven.com/a/tree_small_02 | Slender trees at the far garden corners and the street |
| pachira_aquatica_01 | https://polyhaven.com/a/pachira_aquatica_01 | Large plant in the living room corner |
| potted_plant_01 | https://polyhaven.com/a/potted_plant_01 | Plant in the office corner |
| potted_plant_04 | https://polyhaven.com/a/potted_plant_04 | Small plants: kitchen shelf, office desk, en-suite vanity |
| calathea_orbifolia_01 | https://polyhaven.com/a/calathea_orbifolia_01 | Low plants: living-room shelf, master sideboard and nightstand |
| ceramic_vase_01 | https://polyhaven.com/a/ceramic_vase_01 | Dining table, hall bench |
| ceramic_vase_03 | https://polyhaven.com/a/ceramic_vase_03 | Kitchen island, shelves, master sideboard |
| book_encyclopedia_set_01 | https://polyhaven.com/a/book_encyclopedia_set_01 | Book runs on the living-room and office shelves |
| throw_pillows_01 | https://polyhaven.com/a/throw_pillows_01 | Cushion shapes on the sofa, armchairs and beds (dressed in palette linen) |
| wooden_bowl_01 | https://polyhaven.com/a/wooden_bowl_01 | Fruit bowl on the kitchen island |
| shrub_01 | https://polyhaven.com/a/shrub_01 | Perennials in the garden beds and the two planters (8 of its 9 plants) |
| shrub_04 | https://polyhaven.com/a/shrub_04 | Low shrubs mixed into the same beds |

Fonts: none are downloaded. Room names and the plan use a single-stroke pencil alphabet drawn
in code (`site/js/lettering.js`); small text uses the visitor's system font.

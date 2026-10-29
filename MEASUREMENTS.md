# Measurements

Measured on the build PC (Ryzen 9 5900X, Radeon RX 7800 XT, Chrome headless with the GPU, WebGL2
through ANGLE / Direct3D 11) with the hidden comparison mode (`index.html?compare=1`, see the end).
**Desktop** = the Full version at 1600 × 900. **Light** = the phone version at a phone's pixel
count: 390 × 844 at pixel ratio 1.5 = 585 × 1266 pixels, still on the desktop GPU. A real phone's
own numbers come from opening `?compare=1&tier=light` on the phone.

## Summary (final, milestone 6)

| | Desktop | Light (phones) |
|---|---|---|
| Download, whole tour (textures + lightmaps + models, KTX2) | **30.9 MB** (was 37.1 MB with JPEG / PNG) | **11.9 MB** (was 19.5 MB) |
| + three.js, decoders and site code (uncompressed; ≈ 1 MB with the host's gzip) | 3.6 MB | 3.6 MB |
| … of which at the start (all textures, lightmaps, trees, front and hall) | 22.8 MB | 5.9 MB |
| … and room by room on the way (styling) | 8.1 MB | 6.0 MB |
| GPU memory for textures, lightmaps, models | **88 MB** (was 350 MB as JPEG / PNG) | **34 MB** here, **≈ 24 MB** on a phone (was 134 MB) |
| GPU time per frame, baked light (3 stops) | **0.70–0.78 ms** | **0.27–0.31 ms** |
| … with a live sun + sky + shadow map instead | 1.4–4.5 ms | 3.4–3.9 ms |
| … with the 59 lamps live as well | 3.2–5.9 ms | 4.1–4.9 ms |

Baking is 2–14× cheaper per frame than a live sun with shadows and 4–16× cheaper than live
lamps, and the live versions still have no bounce light, no light through the glass and no soft
lamp light. KTX2 cuts GPU memory by 4× (on phones 5.5×), the download of the models by a third or more and
of the lightmaps by more than half. The relief maps cost download on desktop (see below).

## Download: raw vs compressed

| | Desktop | Light |
|---|---|---|
| Poly Haven originals (all approved downloads, `assets-src/`, not on the website) | 280.2 MB | (same) |
| Bake output before compression: lightmaps (PNG) | 7.06 MB | 2.24 MB |
| Bake output before compression: models (JPEG / PNG textures inside, Draco geometry) | 20.78 MB | 15.07 MB |
| Textures as JPEG / PNG | 9.23 MB | 2.18 MB |
| **Website as JPEG / PNG** | **37.08 MB** | **19.48 MB** |
| **Website as KTX2** | **30.88 MB** | **11.90 MB** |

Per kind (the browser's own count matched the files to 0.01 MB):

| MB | Desktop JPEG / PNG | Desktop KTX2 | Light JPEG / PNG | Light KTX2 |
|---|---|---|---|---|
| Textures | 9.23 | 13.85 | 2.18 | 1.85 |
| Lightmaps | 7.06 | 3.13 | 2.24 | 0.95 |
| Models | 20.78 | 13.90 | 15.07 | 9.10 |

Desktop textures grow with KTX2 because the relief (normal) maps are UASTC — 4.6 MB more than
the JPEGs, for clean relief under the raking sun (DECISIONS.md). Colour and roughness maps
(ETC1S) are about the size of the JPEGs. Phones get ETC1S relief maps, so their textures shrink.

The whole `site/` folder is 88 MB on disk: 61 MB without `site/compare/` (27 MB, the models with
JPEG / PNG inside, only for the comparison mode). A visitor downloads one version, as above.

### Styling, loaded room by room
MB, KTX2. Each file is fetched about one room before the tour gets there, so a phone never holds
or loads the whole house at once; the trees load at the start.

| Room file | Desktop | Light |
|---|---|---|
| front | 0.03 | 0.03 |
| hall | 0.07 | 0.07 |
| wc | 0.01 | 0.01 |
| office | 1.13 | 1.13 |
| ldk | 2.10 | 2.10 |
| master | 0.60 | 0.60 |
| dressing | 0.28 | 0.28 |
| ensuite | 0.19 | 0.19 |
| kid | 0.12 | 0.12 |
| kidbath | 0.01 | 0.01 |
| garden (plants, hedge sprays, umbrella, fire bowl…) | 3.68 | 1.61 |
| trees (at the start) | 5.69 | 2.97 |
| **total** | **13.90** | **9.10** |

## GPU memory: KTX2 vs JPEG

MB. JPEG / PNG = RGBA8 with mipmaps (lightmaps without), as WebGL keeps them. KTX2 "this PC" =
measured from the blocks actually uploaded (BC7, 1 byte per pixel). KTX2 "phone" = computed from
the formats a phone's GPU gets (ETC1S → ETC1 at 0.5 byte per pixel, ETC2 with alpha 1 byte;
UASTC → ASTC 4×4, 1 byte).

| MB | Desktop JPEG / PNG | Desktop KTX2 | Light JPEG / PNG | Light KTX2 (this PC) | Light KTX2 (phone) |
|---|---|---|---|---|---|
| Textures | 238.0 | 59.5 | 59.5 | 14.9 | 7.4 |
| Lightmaps | 50.3 | 12.6 | 12.6 | 3.1 | 3.1 |
| Models | 61.9 | 15.5 | 61.9 | 15.5 | 13.8 |
| **Total** | **350.2** | **87.6** | **134.0** | **33.5** | **24.4** |
| Drawing sheets, art, sky (made in the page, not files) | 113.1 | 113.1 | 43.6 | 43.6 | 43.6 |

Uploaded on this PC: 78 textures as BC7, 13 as RGBA8 (the drawing sheets, the painted art, the
1-pixel stand-ins). The pencil drawing sheets are now the largest item in GPU memory; on phones
they are 2048² instead of 4096² / 3072². Live shadows would add a shadow map on top: 64 MB at
4096² (desktop), 4 MB at 1024² (light).

## GPU time per frame: baked vs live light

WebGL2 timer query (`EXT_disjoint_timer_query_webgl2`), median of 144–145 frames per cell, at
three photo stops. "Live" = the realtime fallback: a sun with a shadow map (4096² desktop, 1024²
light) and a sky light; "+ 59 lamps" adds every lamp of the lighting plan as a live point light.

| ms per frame | Desktop baked | Desktop live | Desktop live + lamps | Light baked | Light live | Light live + lamps |
|---|---|---|---|---|---|---|
| Living · dining · kitchen | **0.78** | 1.37 | 3.16 | **0.31** | 3.66 | 4.38 |
| Pool terrace | **0.70** | 4.29 | 5.88 | **0.27** | 3.73 | 4.10 |
| Master suite | **0.72** | 3.79 | 5.36 | **0.31** | 3.74 | 4.94 |
| Baked, with JPEG / PNG textures instead | 0.73–0.82 | | | 0.27–0.31 | | |

- Baked light is steady between runs (± 0.1 ms). The live numbers vary more: repeat runs gave
  1.2–4.5 ms for live light at the same stops (the GPU's clock states; the live frames also draw
  the whole house and garden a second time, into the shadow map).
- Cross-check at equal pixels: at 585 × 1266 the desktop version's baked frame takes 0.47–0.54 ms,
  the light version 0.27–0.31 ms; at 1600 × 900 desktop 0.70–0.78 ms, light 0.48–0.58 ms. The
  light assets save 25–45 % on their own, before the smaller screen.
- KTX2 vs JPEG makes no measurable difference to frame time on this card (memory, not speed, is
  what it saves here); on phones, with less memory bandwidth, smaller textures also mean faster
  sampling.
- A phone GPU is many times slower than this card, but the ratios hold: the baked light version
  is the cheapest way to draw this scene by a wide margin.

## Baked light (milestones 3–5)
| Atlas | Size | Patches | Texel density |
|---|---|---|---|
| Architecture (walls, floors, ceilings, roof, doors, rooflights) | 2048² | 717 | 38.7 texels/m (2.6 cm) |
| Furniture and fixtures | 2048² | 2,121 | 73 texels/m (1.4 cm) |
| Garden (terrace, pool, lawn, beds, planters) | 2048² | 142 | 36.2 texels/m (2.8 cm) |

Each atlas holds golden-hour daylight (RGB) and the lamps (A), square-root encoded; phones load the
1024² versions. Styling and trees carry the same two layers per vertex.

| Lightmap | PNG | KTX2 (UASTC) | PNG 1024² | KTX2 1024² |
|---|---|---|---|---|
| arch | 2.22 MB | 1.03 MB | 0.71 MB | 0.32 MB |
| items | 3.11 MB | 1.41 MB | 0.99 MB | 0.42 MB |
| site | 1.73 MB | 0.70 MB | 0.54 MB | 0.21 MB |

Bake: Blender 5.1, Cycles on the GPU (HIP), 2048 samples daylight / 3072 lamps for the atlases,
1024 / 2048 per vertex, OIDN denoise: 35 min for everything (atlases 31 min, styling 2.5 min,
trees 1.5 min). Re-baking only the styling and trees: 4 min; one atlas: 15 min.
KTX2 compression of everything (`tools/compress.mjs`, all CPU cores): about 1.5 min.

## How it was measured
- `index.html?compare=1` (hidden): loads every room, then at the living room, the pool terrace
  and the master suite switches the light between baked, live sun + shadows and live + 59 lamps
  and times the GPU. It sums what was downloaded (the browser's Resource Timing) and the GPU memory
  of every texture from its uploaded format. A link at the end repeats the run with JPEG / PNG
  textures (`&tex=jpg`); then both columns show side by side. `&tier=light` for the phone
  version. Where a GPU has no timer query (most phones), it times render + readPixels instead
  and says so.
- `node tools/measure.mjs` runs the four combinations headless and writes `bake/measure.json`;
  `node tools/measure-report.mjs` turns that and `site/compressed.json` into these tables.

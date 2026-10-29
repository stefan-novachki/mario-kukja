### Desktop (Full) — 1600 × 900 px, ANGLE (AMD, AMD Radeon RX 7800 XT (0x0000747E) Direct3D11 vs_5_0 ps_5_0, D3D11)

**Download** (MB; the whole tour, every room loaded)

| | JPEG / PNG | KTX2 | measured in the browser: JPEG / PNG → KTX2 |
|---|---|---|---|
| textures | 9.23 | 13.85 | 9.24 → 13.86 |
| lightmaps | 7.06 | 3.13 | 7.06 → 3.13 |
| models | 20.78 | 13.90 | 20.78 → 13.90 |
| **textures + lightmaps + models** | **37.08** | **30.88** | 37.08 → 30.89 |
| three.js + decoders, site code | | | 3.58 |

**GPU memory** (MB)

| | JPEG / PNG (RGBA8) | KTX2 on this PC (measured) | KTX2 on a phone (ASTC / ETC, computed) |
|---|---|---|---|
| textures | 238.0 | 59.5 | 38.0 |
| lightmaps | 50.3 | 12.6 | 12.6 |
| models | 61.9 | 15.5 | 13.8 |
| **total** | **350.2** | **87.6** | **64.4** |
| drawing sheets, art, sky (canvas textures, same in both) | 113.1 | 113.1 | |

(computed from the files: JPEG / PNG 367.7 MB, KTX2 on a desktop GPU 91.9 MB.) Formats uploaded here: 78 × compressed 36492, 13 × RGBA8.

**GPU time per frame** (ms, median of 144 frames, WebGL2 timer query; shadow map 4096²)

| Stop | Baked light | Live sun + sky + shadows | Live + 59 lamps | with JPEG / PNG textures: baked |
|---|---|---|---|---|
| ldk | **0.78** | 1.37 | 3.16 | 0.82 |
| terrace | **0.70** | 4.29 | 5.88 | 0.73 |
| master | **0.72** | 3.79 | 5.36 | 0.73 |

### Light (phones) — 585 × 1266 px, ANGLE (AMD, AMD Radeon RX 7800 XT (0x0000747E) Direct3D11 vs_5_0 ps_5_0, D3D11)

**Download** (MB; the whole tour, every room loaded)

| | JPEG / PNG | KTX2 | measured in the browser: JPEG / PNG → KTX2 |
|---|---|---|---|
| textures | 2.18 | 1.85 | 2.18 → 1.86 |
| lightmaps | 2.24 | 0.95 | 2.24 → 0.95 |
| models | 15.07 | 9.10 | 15.07 → 9.10 |
| **textures + lightmaps + models** | **19.48** | **11.90** | 19.49 → 11.91 |
| three.js + decoders, site code | | | 3.58 |

**GPU memory** (MB)

| | JPEG / PNG (RGBA8) | KTX2 on this PC (measured) | KTX2 on a phone (ASTC / ETC, computed) |
|---|---|---|---|
| textures | 59.5 | 14.9 | 7.4 |
| lightmaps | 12.6 | 3.1 | 3.1 |
| models | 61.9 | 15.5 | 13.8 |
| **total** | **134.0** | **33.5** | **24.4** |
| drawing sheets, art, sky (canvas textures, same in both) | 43.6 | 43.6 | |

(computed from the files: JPEG / PNG 151.4 MB, KTX2 on a desktop GPU 37.9 MB.) Formats uploaded here: 78 × compressed 36492, 13 × RGBA8.

**GPU time per frame** (ms, median of 145 frames, WebGL2 timer query; shadow map 1024²)

| Stop | Baked light | Live sun + sky + shadows | Live + 59 lamps | with JPEG / PNG textures: baked |
|---|---|---|---|---|
| ldk | **0.31** | 3.66 | 4.38 | 0.31 |
| terrace | **0.27** | 3.73 | 4.10 | 0.27 |
| master | **0.31** | 3.74 | 4.94 | 0.31 |

**Styling, loaded room by room** (MB, KTX2; each file is fetched about one room before the tour gets there)

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
| garden | 3.68 | 1.61 |
| trees (loaded at the start) | 5.69 | 2.97 |
| **total** | **13.90** | **9.10** |

Raw sources: Poly Haven originals 280.2 MB (assets-src/), bake output before compression: lightmaps 9.30 MB, models 27.66 MB.

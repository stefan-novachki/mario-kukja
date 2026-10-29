# Decisions and why

## Reading the renders
- **Six images, one house.** The street view, the aerial and the SketchUp model give the
  massing; the cut-away top view gives the plan; the interior render gives the living room; the
  garden view gives the back. Where the renders disagree (the garage is timber in one image and
  anthracite in the others; one garden view is mirrored; the dining table is inside in two
  renders and outside in one), the majority wins: an anthracite garage, the plan as in the top
  view, dining inside *and* an outdoor table on the terrace.
- **Orientation:** street at the bottom, driveway on the left (west), neighbour's gabled house on
  the right (east), garden at the back (north). The low evening sun then comes along the driveway
  and into the corner glazing of the living pavilion.
- **Sizes** come from the top view, scaled by the beds (a 1.6 × 2.0 m double bed ≈ 68 px/m):
  about 11.9 × 15.4 m overall, 144.5 m² net living area, single storey.

## Plan (kept from the renders, improved where the checks asked for it)
- **Three volumes as built in the renders:** timber front block (porch, kid's room, master
  bedroom), taller white block (hall, bedroom 2, bathroom, WC, en-suite, pantry), timber living
  pavilion. The hall runs straight from the front door to the living room, so the first view is
  the garden at the far end.
- **Master suite:** the front bedroom next to the en-suite (as the top view has the en-suite door
  in that bedroom); the larger middle room is bedroom 2.
- **Rooms without a window** (hall, bathroom, WC, en-suite shower) get roof lights.
- **Changed after the first checks:**
  - the island was shortened and pulled 0.35 m off the wall (the walkway past its end was
    0.75 m); the dining table moved to the middle of the pavilion, between the living corner and
    the island, because between the island and the glass there was no room to sit and pass;
  - the master bed moved 0.3 m towards the street, so the way to the en-suite is 1.0 m wide;
  - both walk-in showers have their glass on the far side, so they are entered past the basin;
  - the toilets moved 5–10 cm for the 15 in side clearance;
  - the driveway-side glazing is fixed (the sofa backs onto it, as in the renders); the garden
    slider opens beside the sofa;
  - the garage is 0.5 m deeper (5.9 m clear) for one car.
- All 64 plan checks pass.

## 3D
- **Same engine, new house.** The site is the Villa Ambra engine (pencil plan → rising walls →
  rooms turning real, calm one-movement-at-a-time camera, baked light, room cards). The plan
  data now also describes **volumes** (own height, roof, ceiling and facade finish), **facade
  finishes per wall** (timber, white render, anthracite, a grey concrete plinth band) and
  **interior accent walls** (black paint behind the kitchen), all generated from the same data
  as the drawing.
- **Standing-seam fascia** on the front block: a band 40 mm proud of the cladding with a seam
  every 420 mm, as in the street render.
- **Timber cladding texture** generated from the Poly Haven oak veneer: horizontal boards with a
  shadow gap and a slight shiplap relief (`tools/prep-textures.py`, set `cedar`).
- **New pieces built in code:** L-shaped sofa with a proper corner, upholstered dining chairs,
  stools with a foot rail, kitchen wall with wall cabinets and a fridge, an island with waterfall
  ends along its short sides, media unit with a television, outdoor kitchen with a grill,
  pergola, fences with rendered plinths, gates, the angled concrete wall at the drive, the
  neighbour's gable house.
- **The front fence is lower (1.1 m) than the side fences (1.45 m)**, so from the street the
  house shows over it.

## Tour
- Street (from the driveway side, like the street render) → along the pavement to the garden
  gate → over the stepping stones → through the front door → the hall with its view to the
  garden → kid's bedroom → master bedroom → en-suite → bedroom 2 → living · dining · kitchen
  (framed like the interior render) → garden and pergola (like the garden render) → rise over
  the street corner into the dusk (like the aerial). All camera checks pass.

## Light
- Baked in Blender (installed for this project): low evening sun from the west, sky, and all
  lamps, into three lightmap atlases plus the light per vertex of the styling and trees. The
  laptop has no Cycles-capable GPU, so the bake runs on the CPU with fewer samples and the
  OIDN denoiser.
- A bug fixed on the way: the sky shader took `pow()` of a value a hair below zero for one sun
  direction, which turned the reflection map into NaN and every surface black in the realtime
  fallback.

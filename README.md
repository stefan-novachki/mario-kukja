# Kukja Mario — scroll walkthrough

A static website for the house in the design renders: it opens on the pencil floor plan, and
scrolling lifts the walls out of the drawing and walks you through the house, room by room, out
to the garden and the pergola, and up into the dusk. It is built on the same engine as
`../villa-ambra` (same look, same camera rhythm, same baked light); the house itself, its
plan, facades, furniture and garden, is new and follows the renders.

The whole website is the folder `site/`; everything else here is how it was made.

## The house (from the renders)
- **Three volumes:** a timber front block under a dark standing-seam metal fascia with anthracite
  corners (recessed porch with an oak door and sidelight, kid's bedroom, master bedroom); a
  taller white rendered block in the middle (hall, bedroom 2, bathroom, guest WC, en-suite,
  pantry); and the timber living pavilion at the back with sliding glass round its corner.
- **Inside:** light oak floors; a kitchen wall with white tall units, walnut wall cabinets and a
  steel fridge; an island with a white waterfall top and walnut stools; navy L-sofa and
  armchairs; a light oak block coffee table; black accent walls; dome pendants.
- **Outside:** a long concrete-slab driveway to a detached anthracite garage, a timber pergola
  with an outdoor kitchen and lounge, a paved terrace with an outdoor table, a front lawn with
  stepping stones and young trees, white rendered fence plinths with dark slats, and the
  neighbour's gabled house beyond the fence.
- Plan checks (`npm run checks`): 64 of 64 pass — kitchen work triangle and aisles (NKBA),
  bathroom clearances (IRC), door swings, walking routes with the furniture in place, daylight,
  escape windows.

## Put it on Vercel
The site is plain files, no build step. `vercel.json` tells Vercel to publish `site/` as it is;
`.vercelignore` keeps the source files out of the upload.

**From the command line** (Node.js is installed on this PC):
```
npx vercel@latest            # first time: log in, accept the defaults → a preview address
npx vercel@latest --prod     # the live address
```
Run both from this folder (`Desktop/mario-kukja`).

**From GitHub:** put this folder in its own repository, then on vercel.com → Add New → Project
→ import the repository. Vercel reads `vercel.json`; there is nothing to set (Framework:
Other, output directory `site`).

**By hand:** vercel.com → Add New → Project → *Deploy* with the folder dragged in also works,
as long as `vercel.json` comes with it.

## Look at it on this computer
- **Windows:** double-click `start.bat` (a small local web server on http://localhost:8080).
- With Node.js: `npm run serve`.

Opening `index.html` straight from the disk does not work (browsers block modules and textures
from `file://`).

Useful addresses:
- `plan.html` — the floor plan sheet, the area schedule and all plan checks (m / ft-in switch).
- `index.html?at=ldk` — jump to a stop (`front, hall, kid, master, ensuite, guest, ldk, terrace, end`), to
  a room's view from above (`?at=ldk-above`) or halfway down into it (`?at=ldk-down`); add `&card=open`
  for the designer's notes.
- `index.html?tier=light` / `?tier=desktop` — force the phone or the desktop version.
- `index.html?bake=0` — the realtime light instead of the baked light.
- `index.html?debug=1` — frame rate, draw calls and triangles.

## Checks
```
npm run checks       # 64 plan checks
npm run check-path   # camera: clearance, free view, speed, turn rate, one movement at a time
```

## Rebuilding the light and the models
Needed after changing the plan, the furniture, the styling or the lamps (Blender 5.2 is installed).
```
npm install                                          # build tools into node_modules/
node tools/polyhaven-download.mjs                    # the Poly Haven originals → assets-src/
python -I tools/prep-textures.py                     # site/textures (plus the generated timber cladding)
blender -b --factory-startup --python tools/blender/prep-models.py   # props and shrubs → bake/models
blender -b --factory-startup --python tools/blender/prep-trees.py    # trees → leaf cards
node tools/export-bake.mjs                           # bake/house.glb + lamps + placements + atlas layout
blender -b --factory-startup --python tools/blender/bake.py -- --samples 128 --lamp-samples 192 --vsamples 128
node tools/compress.mjs                              # textures, lightmaps and models → KTX2
```
On this laptop (6-core CPU, no supported GPU for Cycles) the bake runs on the CPU.

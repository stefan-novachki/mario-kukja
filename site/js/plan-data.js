// KUKJA MARIO — single source of truth for the plan.
// Metres. Origin = the street-side corner of the living pavilion on the driveway side.
// +x runs along the street (driveway side → neighbour side), +y runs from the street (front)
// to the back garden. North points to +y: the garden lies north, the driveway west, so the low
// evening sun comes along the driveway and straight into the corner glazing of the living room.
// Every rectangle is [x0, y0, x1, y1] with x0 < x1, y0 < y1.
//
// Three volumes, as in the design renders: a timber front block under a standing-seam metal
// fascia (porch, two bedrooms), a taller white rendered block in the middle (hall, bedroom 2,
// bathrooms) and a timber living pavilion at the back with sliding glass round its corner.
// A detached anthracite garage with a timber pergola stands at the end of the driveway.

export const META = {
  project: 'KUKJA MARIO',
  subtitle: 'Single-storey house with garage, pergola and garden',
  drawing: 'Ground floor plan',
  sheet: 'A-101',
  scale: '1:100 @ A2',
  date: '29.10.2026',
  drawnBy: 'CLAUDE',
  rev: 'A',
  ceiling: 2.7,        // clear ceiling height, front block (bedrooms, hall)
  ceilingLDK: 3.0,     // living pavilion and the white block
  northDeg: 0,         // north arrow points up the sheet (+y)
};

// Volumes: outer rectangle, top of the parapet, roof surface, clear ceiling of the rooms inside,
// and the exterior finish their walls get by default.
export const VOLUMES = {
  front: { r: [1.6, 0, 11.9, 4.75], top: 3.4, roof: 3.26, ceiling: 2.7, fin: 'cedar', fascia: [2.75, 3.46] },
  white: { r: [0.9, 4.75, 11.9, 9.9], top: 3.95, roof: 3.82, ceiling: 3.0, fin: 'render' },
  ldk: { r: [0, 9.6, 11.9, 15.4], top: 3.55, roof: 3.42, ceiling: 3.0, fin: 'cedar' },
  garage: { r: [-6.4, 17.6, -0.4, 24.1], top: 3.0, roof: 2.88, ceiling: 2.7, fin: 'anthracite' },
};

// ---------------------------------------------------------------- walls
// t: 'ext' 300 mm insulated masonry, 'vol' 300 mm wall between two volumes (inside below the
// lower roof, exterior render above it), 'int' 120 mm partitions.
// vol = the volume a wall belongs to (its height); fin = exterior finish where it differs from
// the volume's; fins = [{ s: [a, b], m }] finish bands along the wall (s = along its length).
export const WALLS = [
  // front block
  { id: 'W1', t: 'ext', vol: 'front', r: [1.6, 0, 5.6, 0.3], fins: [{ s: [1.6, 2.0], m: 'anthracite' }] },       // kid's room front
  { id: 'W2', t: 'ext', vol: 'front', r: [5.6, 0, 5.9, 1.3], fin: 'anthracite' },                                // porch, west side
  { id: 'W3', t: 'ext', vol: 'front', r: [7.7, 0, 8.0, 1.3], fin: 'anthracite' },                                // porch, east side
  { id: 'W4', t: 'ext', vol: 'front', r: [5.9, 1.0, 7.7, 1.3], fin: 'anthracite' },                              // front door wall
  { id: 'W5', t: 'ext', vol: 'front', r: [8.0, 0, 11.9, 0.3], fins: [{ s: [11.5, 11.9], m: 'anthracite' }] },    // master front
  { id: 'W6', t: 'ext', vol: 'front', r: [1.6, 0.3, 1.9, 4.75], fin: 'anthracite' },                             // driveway side
  { id: 'W7', t: 'ext', vol: 'front', r: [11.6, 0.3, 11.9, 4.75], fin: 'anthracite' },                           // neighbour side
  { id: 'W8', t: 'int', vol: 'front', r: [5.78, 1.3, 5.9, 4.75] },                                               // kid | hall
  { id: 'W9', t: 'int', vol: 'front', r: [7.7, 1.3, 7.82, 4.75] },                                               // hall | master
  // white block
  { id: 'W10', t: 'ext', vol: 'white', r: [0.9, 4.75, 1.9, 5.05] },                                              // step on the driveway side
  { id: 'W11', t: 'vol', vol: 'white', r: [1.9, 4.75, 5.9, 5.05] },                                              // kid | bedroom 2
  { id: 'W12', t: 'vol', vol: 'white', r: [5.9, 4.75, 7.7, 5.05] },                                              // over the hall
  { id: 'W13', t: 'vol', vol: 'white', r: [7.7, 4.75, 11.6, 5.05] },                                             // master | en-suite, bathroom
  { id: 'W14', t: 'ext', vol: 'white', r: [0.9, 5.05, 1.2, 9.6] },                                               // bedroom 2, driveway side
  { id: 'W15', t: 'ext', vol: 'white', r: [11.6, 4.75, 11.9, 9.9] },                                             // neighbour side
  { id: 'W16', t: 'vol', vol: 'white', r: [0.9, 9.6, 11.6, 9.9] },                                               // white block | living pavilion
  { id: 'W17', t: 'int', vol: 'white', r: [5.78, 5.05, 5.9, 9.6] },                                              // bedroom 2 | hall
  { id: 'W18', t: 'int', vol: 'white', r: [7.7, 5.05, 7.82, 9.6] },                                              // hall | bathrooms
  { id: 'W19', t: 'int', vol: 'white', r: [9.4, 5.05, 9.52, 9.6] },                                              // bathroom, WC | en-suite, pantry
  { id: 'W20', t: 'int', vol: 'white', r: [7.82, 7.95, 11.6, 8.07] },                                            // bathroom | WC, en-suite | pantry
  // living pavilion
  { id: 'W21', t: 'ext', vol: 'ldk', r: [0, 9.6, 0.9, 9.9] },                                                    // corner window, street side
  { id: 'W22', t: 'ext', vol: 'ldk', r: [0, 9.9, 0.3, 15.1] },                                                   // driveway side, glass
  { id: 'W23', t: 'ext', vol: 'ldk', r: [0, 15.1, 11.9, 15.4] },                                                 // garden side, glass
  { id: 'W24', t: 'ext', vol: 'ldk', r: [11.6, 9.9, 11.9, 15.1], fin: 'anthracite' },                            // neighbour side
  // detached garage
  { id: 'G1w', t: 'ext', vol: 'garage', r: [-6.4, 17.6, -0.4, 17.9] },
  { id: 'G2w', t: 'ext', vol: 'garage', r: [-6.4, 23.8, -0.4, 24.1] },
  { id: 'G3w', t: 'ext', vol: 'garage', r: [-6.4, 17.9, -6.1, 23.8] },
  { id: 'G4w', t: 'ext', vol: 'garage', r: [-0.7, 17.9, -0.4, 23.8] },
];

// ---------------------------------------------------------------- openings
// Rect lies inside the wall thickness. Doors: hinge = pivot point on the face the
// leaf swings into, swing = unit direction of the leaf when open at 90°.
// sill/head in metres above finished floor. Sliders: slide = [moving panel, panel it parks over].
export const OPENINGS = [
  { id: 'D1', kind: 'door', r: [6.0, 1.0, 7.05, 1.3], hinge: [6.0, 1.3], swing: [0, 1], head: 2.4, note: 'Front door, oak, 1050' },
  { id: 'D2', kind: 'door', r: [5.78, 3.85, 5.9, 4.65], hinge: [5.78, 4.65], swing: [-1, 0], head: 2.2 },       // kid's room
  { id: 'D3', kind: 'door', r: [7.7, 2.9, 7.82, 3.75], hinge: [7.82, 3.75], swing: [1, 0], head: 2.2 },         // master
  { id: 'D4', kind: 'door', r: [10.6, 4.75, 11.4, 5.05], hinge: [11.4, 5.05], swing: [0, 1], head: 2.2 },       // en-suite
  { id: 'D5', kind: 'door', r: [5.78, 5.25, 5.9, 6.1], hinge: [5.78, 5.25], swing: [-1, 0], head: 2.2 },        // bedroom 2
  { id: 'D6', kind: 'door', r: [7.7, 5.15, 7.82, 5.9], hinge: [7.82, 5.15], swing: [1, 0], head: 2.2 },         // bathroom
  { id: 'D7', kind: 'door', r: [7.7, 8.75, 7.82, 9.5], hinge: [7.82, 9.5], swing: [1, 0], head: 2.2 },          // guest WC
  { id: 'D8', kind: 'door', r: [10.35, 9.6, 11.15, 9.9], hinge: [11.15, 9.6], swing: [0, -1], head: 2.2 },      // pantry, from the kitchen
  { id: 'O1', kind: 'opening', r: [5.9, 4.75, 7.7, 5.05], head: 2.7 },                                         // hall runs on into the white block
  { id: 'O2', kind: 'opening', r: [5.9, 9.6, 7.7, 9.9], head: 2.7 },                                           // hall → living pavilion
  { id: 'D9', kind: 'garage', r: [-4.7, 17.6, -1.7, 17.9], head: 2.3, note: 'Sectional garage door 3000' },
  { id: 'D10', kind: 'door', r: [-5.9, 17.6, -5.0, 17.9], hinge: [-5.9, 17.9], swing: [0, 1], head: 2.1 },      // garage side door
  // glazing
  { id: 'G1', kind: 'window', r: [2.55, 0, 4.85, 0.3], sill: 0.85, head: 2.35, mullions: 1, note: 'kid' },
  { id: 'G2', kind: 'window', r: [8.95, 0, 11.05, 0.3], sill: 0.85, head: 2.35, mullions: 1, note: 'master' },
  { id: 'G3', kind: 'window', r: [7.12, 1.0, 7.6, 1.3], sill: 0.05, head: 2.4, note: 'sidelight' },
  { id: 'G4', kind: 'window', r: [0.9, 6.4, 1.2, 8.0], sill: 0.8, head: 2.5, note: 'bedroom 2' },
  { id: 'G5', kind: 'window', r: [11.6, 5.9, 11.9, 6.9], sill: 1.65, head: 2.45, note: 'high, obscured' },
  { id: 'G6', kind: 'window', r: [0.3, 9.6, 0.9, 9.9], sill: 0, head: 2.7, note: 'corner glazing' },
  { id: 'G7', kind: 'window', r: [0, 10.1, 0.3, 14.9], sill: 0, head: 2.7, mullions: 1, note: 'Fixed glazing, black frame' },
  { id: 'G8', kind: 'slider', r: [0.45, 15.1, 9.05, 15.4], panels: 4, slide: [[2, 3]], sill: 0, head: 2.7, note: 'Lift-and-slide, black frame' },
  { id: 'G9', kind: 'window', r: [11.6, 14.25, 11.9, 14.7], sill: 0.9, head: 2.55, note: 'slot window' },
  { id: 'G10', kind: 'window', r: [-0.7, 19.6, -0.4, 20.5], sill: 1.5, head: 2.1, note: 'garage' },
];

// Roof lights (drawn dashed: overhead) for the rooms without an outside wall
export const SKYLIGHTS = [
  { id: 'S1', r: [6.25, 6.6, 7.35, 7.9] },    // hall, in the white block
  { id: 'S2', r: [8.2, 6.95, 9.0, 7.65] },    // bathroom, over the shower
  { id: 'S3', r: [8.25, 8.45, 8.95, 9.15] },  // guest WC
  { id: 'S4', r: [10.0, 7.05, 11.1, 7.7] },   // en-suite, over the walk-in shower
];

// Interior wall faces in another finish: { axis, sign, c, u: [a, b], room } → paint.
// (axis / sign = the face normal, c = its position, u = range along the face)
export const ACCENTS = [
  { axis: 'x', sign: -1, c: 11.6, u: [9.9, 15.1], m: 'paintBlack' },      // kitchen wall
  { axis: 'y', sign: 1, c: 9.9, u: [7.7, 11.6], m: 'paintBlack' },        // behind the island, pantry door wall
];

// ---------------------------------------------------------------- rooms
// main: habitable room that needs daylight. rects: first rect is the "size" shown.
export const ROOMS = [
  { id: 'hall', name: 'Entrance hall', zone: 'public', vol: 'front', rects: [[5.9, 1.3, 7.7, 9.6]], label: [6.8, 3.4], wrap: true },
  { id: 'kid', name: "Kid's bedroom", zone: 'private', vol: 'front', main: true, rects: [[1.9, 0.3, 5.6, 4.75], [5.6, 1.3, 5.78, 4.75]], label: [3.75, 2.0], wrap: true },
  { id: 'master', name: 'Master bedroom', zone: 'private', vol: 'front', main: true, rects: [[8.0, 0.3, 11.6, 4.75], [7.82, 1.3, 8.0, 4.75]], label: [9.6, 1.6], wrap: true },
  { id: 'ensuite', name: 'En-suite', zone: 'private', vol: 'white', rects: [[9.52, 5.05, 11.6, 7.95]], label: [10.55, 5.6], small: true },
  { id: 'guest', name: 'Bedroom 2', zone: 'private', vol: 'white', main: true, rects: [[1.2, 5.05, 5.78, 9.6]], label: [3.4, 6.5] },
  { id: 'bath', name: 'Bathroom', zone: 'private', vol: 'white', rects: [[7.82, 5.05, 9.4, 7.95]], label: [8.35, 5.75], small: true },
  { id: 'wc', name: 'Guest WC', zone: 'public', vol: 'white', rects: [[7.82, 8.07, 9.4, 9.6]], label: [8.45, 8.3], small: true },
  { id: 'pantry', name: 'Pantry', zone: 'service', vol: 'white', rects: [[9.52, 8.07, 11.6, 9.6]], label: [10.55, 8.45], small: true },
  { id: 'ldk', name: 'Living · Dining · Kitchen', zone: 'public', vol: 'ldk', main: true, rects: [[0.3, 9.9, 11.6, 15.1]], label: [5.5, 10.6] },
  { id: 'garage', name: 'Garage', zone: 'service', vol: 'garage', rects: [[-6.1, 17.9, -0.7, 23.8]], label: [-3.4, 21.9] },
];

export function roomArea(room) {
  return room.rects.reduce((a, [x0, y0, x1, y1]) => a + (x1 - x0) * (y1 - y0), 0);
}

// ---------------------------------------------------------------- furniture & fixtures
// kind drives the pencil symbol (and later the 3D model). face = direction the user faces
// when using it (beds: direction from head to foot). h = height in metres.
export const ITEMS = [
  // hall
  { id: 'hward', kind: 'wardrobe', room: 'hall', r: [5.9, 2.4, 6.5, 3.7], h: 2.4, face: [1, 0] },
  { id: 'hbench', kind: 'bench', room: 'hall', r: [7.3, 6.2, 7.7, 7.2], h: 0.45, face: [-1, 0] },
  // kid's bedroom
  { id: 'kbed', kind: 'bed', room: 'kid', r: [1.9, 2.5, 2.95, 4.65], face: [0, -1] },
  { id: 'kns', kind: 'nightstand', room: 'kid', r: [2.98, 4.25, 3.38, 4.65] },
  { id: 'kdesk', kind: 'desk', room: 'kid', r: [2.75, 0.3, 4.15, 0.9], h: 0.74 },
  { id: 'kchair', kind: 'chair', room: 'kid', r: [3.2, 0.98, 3.7, 1.48], face: [0, -1] },
  { id: 'kward', kind: 'wardrobe', room: 'kid', r: [5.0, 0.3, 5.6, 2.2], h: 2.4, face: [-1, 0] },
  { id: 'kbooks', kind: 'shelf', room: 'kid', r: [1.9, 0.75, 2.25, 2.15], h: 1.2 },
  { id: 'krug', kind: 'rug', room: 'kid', r: [3.0, 1.9, 4.7, 3.9], soft: true },
  // master bedroom
  { id: 'mbed', kind: 'bed', room: 'master', r: [9.5, 1.35, 11.6, 3.15], face: [-1, 0] },
  { id: 'mns1', kind: 'nightstand', room: 'master', r: [11.12, 0.85, 11.6, 1.3] },
  { id: 'mns2', kind: 'nightstand', room: 'master', r: [11.12, 3.2, 11.6, 3.65] },
  { id: 'mward', kind: 'wardrobe', room: 'master', r: [8.0, 4.15, 10.4, 4.75], h: 2.4, face: [0, -1] },
  { id: 'mbench', kind: 'bench', room: 'master', r: [9.0, 1.6, 9.4, 2.9], h: 0.45, face: [-1, 0] },
  { id: 'mrug', kind: 'rug', room: 'master', r: [8.6, 0.8, 10.4, 3.7], soft: true },
  { id: 'mchair', kind: 'armchair', room: 'master', r: [8.1, 0.45, 8.9, 1.25], face: [1, 1] },
  // en-suite
  { id: 'eshower', kind: 'shower', room: 'ensuite', r: [9.52, 6.75, 11.6, 7.95], glass: [[10.6, 6.75, 11.6, 6.75]], walkin: true },
  { id: 'evan', kind: 'vanity', room: 'ensuite', r: [9.52, 5.2, 10.02, 6.2], face: [1, 0], basins: 1 },
  { id: 'ewc', kind: 'wc', room: 'ensuite', r: [10.95, 5.95, 11.6, 6.33], face: [-1, 0] },
  // bedroom 2
  { id: 'gbed', kind: 'bed', room: 'guest', r: [2.45, 7.5, 4.25, 9.6], face: [0, -1] },
  { id: 'gns1', kind: 'nightstand', room: 'guest', r: [1.95, 9.12, 2.4, 9.6] },
  { id: 'gns2', kind: 'nightstand', room: 'guest', r: [4.3, 9.12, 4.75, 9.6] },
  { id: 'gward', kind: 'wardrobe', room: 'guest', r: [1.3, 5.05, 4.5, 5.65], h: 2.4, face: [0, 1] },
  { id: 'gside', kind: 'sideboard', room: 'guest', r: [5.33, 6.6, 5.78, 8.2], h: 0.75 },
  { id: 'grug', kind: 'rug', room: 'guest', r: [1.9, 6.4, 4.8, 8.6], soft: true },
  { id: 'gchair', kind: 'armchair', room: 'guest', r: [1.3, 8.2, 2.1, 9.0], face: [1, 0] },
  // family bathroom
  { id: 'bshower', kind: 'shower', room: 'bath', r: [7.82, 6.95, 9.4, 7.95], glass: [[8.82, 6.95, 9.4, 6.95]], walkin: true },
  { id: 'bvan', kind: 'vanity', room: 'bath', r: [8.9, 5.1, 9.4, 5.95], face: [-1, 0], basins: 1 },
  { id: 'bwc', kind: 'wc', room: 'bath', r: [8.75, 6.17, 9.4, 6.55], face: [-1, 0] },
  // guest WC
  { id: 'wc1', kind: 'wc', room: 'wc', r: [8.75, 8.3, 9.4, 8.68], face: [-1, 0] },
  { id: 'bas1', kind: 'basin', room: 'wc', r: [8.95, 9.05, 9.4, 9.5], face: [-1, 0] },
  // pantry
  { id: 'pshelf1', kind: 'shelf', room: 'pantry', r: [9.52, 8.07, 9.92, 9.6], h: 2.2 },
  { id: 'pshelf2', kind: 'shelf', room: 'pantry', r: [9.92, 8.07, 11.6, 8.47], h: 2.2 },
  // kitchen (along the neighbour-side wall, the island parallel to it)
  { id: 'fridge', kind: 'fridge', room: 'ldk', r: [10.95, 9.9, 11.6, 10.65], h: 2.4, face: [-1, 0] },
  { id: 'ktall1', kind: 'tall', room: 'ldk', r: [10.95, 10.65, 11.6, 11.25], h: 2.4, face: [-1, 0] },
  { id: 'kback', kind: 'counter', room: 'ldk', r: [10.95, 11.25, 11.6, 13.55], h: 0.92, face: [-1, 0] },
  { id: 'cooktop', kind: 'cooktop', room: 'ldk', r: [11.0, 12.0, 11.55, 12.8], face: [-1, 0] },
  { id: 'ktall2', kind: 'tall', room: 'ldk', r: [10.95, 13.55, 11.6, 14.15], h: 2.4, face: [-1, 0] },
  { id: 'island', kind: 'island', room: 'ldk', r: [8.43, 11.0, 9.73, 13.0], h: 0.92, overhang: [-1, 0, 0.3] },
  { id: 'sink', kind: 'sink', room: 'ldk', r: [9.25, 11.6, 9.68, 12.4], face: [1, 0] },
  { id: 'stool1', kind: 'stool', room: 'ldk', r: [8.28, 11.25, 8.68, 11.65] },
  { id: 'stool2', kind: 'stool', room: 'ldk', r: [8.28, 11.8, 8.68, 12.2] },
  { id: 'stool3', kind: 'stool', room: 'ldk', r: [8.28, 12.35, 8.68, 12.75] },
  // dining in the middle of the pavilion, between the living corner and the island
  { id: 'dtable', kind: 'table', room: 'ldk', r: [5.92, 12.35, 6.87, 14.15], h: 0.75, seats: 6 },
  { id: 'dc1', kind: 'chair', room: 'ldk', r: [5.45, 12.48, 5.95, 12.92], face: [1, 0] },
  { id: 'dc2', kind: 'chair', room: 'ldk', r: [5.45, 13.03, 5.95, 13.47], face: [1, 0] },
  { id: 'dc3', kind: 'chair', room: 'ldk', r: [5.45, 13.58, 5.95, 14.02], face: [1, 0] },
  { id: 'dc4', kind: 'chair', room: 'ldk', r: [6.84, 12.48, 7.34, 12.92], face: [-1, 0] },
  { id: 'dc5', kind: 'chair', room: 'ldk', r: [6.84, 13.03, 7.34, 13.47], face: [-1, 0] },
  { id: 'dc6', kind: 'chair', room: 'ldk', r: [6.84, 13.58, 7.34, 14.02], face: [-1, 0] },
  // living: the L-shaped sofa backs onto the corner glass, the armchairs face it
  { id: 'rug', kind: 'rug', room: 'ldk', r: [1.5, 11.0, 4.9, 14.3], soft: true },
  { id: 'sofa', kind: 'sofa', room: 'ldk', r: [0.45, 14.05, 4.35, 15.0], face: [0, -1], h: 0.72, corner: 'w' },
  { id: 'sofa2', kind: 'sofa', room: 'ldk', r: [0.45, 11.3, 1.4, 14.05], face: [1, 0], h: 0.72 },
  { id: 'ctable', kind: 'ctable', room: 'ldk', r: [2.05, 11.85, 3.2, 13.0], h: 0.4 },
  { id: 'lchair1', kind: 'armchair', room: 'ldk', r: [3.65, 12.7, 4.5, 13.55], face: [-1, 0] },
  { id: 'lchair2', kind: 'armchair', room: 'ldk', r: [3.65, 11.6, 4.5, 12.45], face: [-1, 0] },
  { id: 'tv', kind: 'media', room: 'ldk', r: [1.9, 9.9, 4.3, 10.32], h: 0.45 },
  { id: 'stable', kind: 'stable', room: 'ldk', r: [0.55, 10.75, 0.95, 11.15] },
  // garage
  { id: 'car1', kind: 'car', room: 'garage', r: [-4.2, 18.5, -2.3, 23.3], face: [0, -1] },
  { id: 'gshelf', kind: 'shelf', room: 'garage', r: [-6.1, 19.4, -5.7, 22.8], h: 1.8 },
];

// Plants standing on the floor (Poly Haven models): they count as furniture in the walking-route
// and camera checks. at = centre of the pot, r = radius of the plant in plan, turn in degrees.
export const PLANTS = [
  { id: 'pachira', model: 'pachira_aquatica_01:d', room: 'ldk', at: [10.95, 14.6], r: 0.45, turn: 25 },    // in the corner by the slot window
  { id: 'hplant', model: 'potted_plant_01:a', room: 'hall', at: [7.42, 7.6], r: 0.28, turn: 40 },         // beside the hall bench
  { id: 'gplant', model: 'potted_plant_01:a', room: 'guest', at: [5.4, 9.25], r: 0.28, turn: 200 },      // bedroom 2 corner
];

// ---------------------------------------------------------------- outside
export const SITE = {
  plot: [-6.6, -6.2, 12.5, 26.5],           // property line (fence line)
  street: -7.4,
  driveway: [-5.1, -7.4, -1.5, 17.6],        // large concrete slabs up to the garage door
  path: [5.6, -1.0, 7.95, 0],                // apron in front of the porch
  apron: [1.6, -1.0, 11.9, 0],               // paving strip along the front of the house
  porch: [5.9, 0, 7.7, 1.0],                 // recessed porch, paved, under the roof
  terrace: [-1.5, 15.4, 9.6, 18.2],          // paving behind the living pavilion
  patio: [-0.4, 18.2, 4.4, 22.4],            // under the pergola
  stones: [[7.5, -2.0, 8.7, -1.45], [8.15, -3.1, 9.35, -2.55], [8.8, -4.2, 10.0, -3.65], [9.45, -5.3, 10.65, -4.75]],
  pergola: { r: [-0.4, 18.3, 4.2, 22.2], posts: [[4.05, 18.45], [4.05, 22.05]], h: 2.75 },
  outdoor: [
    // outdoor dining on the terrace, by the garden glass
    { id: 'otable', kind: 'table', r: [5.4, 16.2, 7.6, 17.15], seats: 6 },
    { id: 'oc1', kind: 'chair', r: [5.6, 15.75, 6.06, 16.25], face: [0, 1] }, { id: 'oc2', kind: 'chair', r: [6.27, 15.75, 6.73, 16.25], face: [0, 1] },
    { id: 'oc3', kind: 'chair', r: [6.94, 15.75, 7.4, 16.25], face: [0, 1] }, { id: 'oc4', kind: 'chair', r: [5.6, 17.1, 6.06, 17.6], face: [0, -1] },
    { id: 'oc5', kind: 'chair', r: [6.27, 17.1, 6.73, 17.6], face: [0, -1] }, { id: 'oc6', kind: 'chair', r: [6.94, 17.1, 7.4, 17.6], face: [0, -1] },
    // lounge and outdoor kitchen under the pergola
    { id: 'osofa', kind: 'sofa', r: [0.0, 20.9, 2.4, 21.75], face: [0, -1] },
    { id: 'octable', kind: 'ctable', r: [0.6, 19.75, 1.8, 20.45] },
    { id: 'oarm1', kind: 'armchair', r: [-0.15, 18.75, 0.65, 19.55], face: [1, 1] },
    { id: 'oarm2', kind: 'armchair', r: [1.75, 18.75, 2.55, 19.55], face: [-1, 1] },
    { id: 'bbq', kind: 'bbq', r: [3.25, 19.1, 3.9, 21.6], face: [-1, 0] },
  ],
  // planted beds (bark mulch, perennials and grasses)
  beds: [[6.2, -3.6, 9.2, -1.3], [9.4, -2.4, 12.3, -1.3], [-6.4, 24.4, 12.3, 25.6], [10.6, 16.0, 12.3, 23.8]],
  // [x, y, crown radius, Poly Haven tree, turn (deg), scale]: young trees in the front lawn like the
  // renders, a larger tree in the back garden, slender ones along the fences
  trees: [[4.2, -3.4, 1.3, 'tree_small_02', 40, 0.75], [11.2, -4.2, 1.3, 'tree_small_02', 200, 0.8],
    [8.6, 23.2, 2.0, 'island_tree_02', 120, 1.0], [-5.8, 25.0, 1.4, 'tree_small_02', 300, 0.95], [11.6, 18.4, 1.3, 'tree_small_02', 70, 0.85]],
  planters: [],
  // fences: white rendered plinth with anthracite horizontal slats; gates are slats only
  fences: [
    { a: [-6.6, -6.2], b: [-5.1, -6.2] }, { a: [-1.5, -6.2], b: [9.5, -6.2] }, { a: [10.6, -6.2], b: [12.5, -6.2] },
    { a: [-6.6, -6.2], b: [-6.6, 26.5] }, { a: [12.5, -6.2], b: [12.5, 26.5] }, { a: [-6.6, 26.5], b: [12.5, 26.5] },
  ],
  gates: [{ a: [-5.1, -6.2], b: [-1.5, -6.2] }, { a: [9.5, -6.2], b: [10.6, -6.2] }],
  // the low angled concrete wall between the driveway and the front lawn, with its light post
  wedge: { a: [-1.35, -5.6], b: [1.1, -2.4], h0: 0.1, h1: 0.6 },
  post: [-1.3, -5.7],
  // the neighbour's gabled house beyond the fence (context only)
  neighbour: { r: [13.4, 0.6, 21.4, 15.8], eave: 3.3, ridge: 7.2 },
};

// Routes used by the checks (main traffic should not cut the kitchen work triangle).
export const ROUTES = {
  hallToGarden: [[6.8, 1.6], [6.8, 9.9], [5.1, 11.5], [5.1, 15.25]],
  hallToDining: [[6.8, 9.9], [6.4, 12.2]],
};

// Kitchen work centres: centre-front of each appliance (NKBA convention).
export const WORK_CENTRES = {
  fridge: [10.95, 10.27],
  cooktop: [10.95, 12.4],
  sink: [9.73, 12.0],     // sink in the island, the cook faces the kitchen wall
};

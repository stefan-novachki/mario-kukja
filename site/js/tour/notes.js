// The interior designer's notes behind the "+" of each room card. Sizes are written as
// [[2.7]] (one length) or [[2.58x1.45]] (width × depth) so they follow the m / ft-in switch.
import { ftIn } from '../units.js';

export const NOTES = {
  front: {
    style: 'Three simple volumes, as in the design: a timber front block under a dark standing-seam fascia, a taller white block behind it, and the timber living pavilion at the back. Anthracite corners hold it together.',
    light: 'The low evening sun comes along the driveway from the west. Two wall lights frame the recessed porch, bollards and a post light lead in from the gate, and uplights catch the two young trees.',
    pieces: 'Oak front door [[1.05]] wide with a full-height bar handle and a glass sidelight · two-pane windows in grey frames · stepping stones through the front lawn · white rendered fence plinths with dark slats.',
  },
  hall: {
    style: 'One straight axis from the front door through the white block into the living room, so the first thing you see is the garden at the far end.',
    light: 'A roof light halfway along brings daylight into the middle of the house; three downlights for the evening.',
    pieces: 'Coat wardrobe [[1.3]] wide by the door · oak bench with a stoneware vase · our own paintings on both walls · light oak floor running on into every room.',
  },
  kid: {
    style: 'Calm and warm: sage and ochre linen, books at a child\'s height, a desk under the street window.',
    light: 'Morning light from the street side. A linen drum pendant, a bedside lamp and a desk lamp for homework.',
    pieces: 'Bed [[1.0x2.1]] along the wall · wardrobe [[1.9]] by the door · low oak shelf with linen boxes · desk [[1.4]] under the window · wool rug.',
  },
  master: {
    style: 'Quiet and soft: oak, linen and walnut. The bed stands against the neighbour wall, the window looks out over the front garden.',
    light: 'Daylight from the street window. Two glass globes hang by the bed, a floor lamp over the reading chair, downlights dimmed low.',
    pieces: 'Bed [[1.8x2.1]] with an upholstered linen headboard · walnut nightstands · linen bench at the foot · reading chair in the window corner · oak wardrobe wall [[2.4]] · en-suite behind it.',
  },
  ensuite: {
    style: 'A light stone room: large grey porcelain in the walk-in shower, white quartz on the vanity, black fittings.',
    light: 'A roof light over the shower and a high window by day; a mirror light over the basin at night.',
    pieces: 'Level walk-in shower [[2.08x1.2]] with a linear drain and rain head · walnut vanity [[1.25]] · wall-hung WC · teak stool · towel ladder.',
  },
  guest: {
    style: 'The largest bedroom, in the taller white block: a calm guest room with a wardrobe wall and a walnut sideboard.',
    light: 'Evening sun through the tall window on the driveway side. Two bedside lamps, a lamp on the sideboard, a downlight.',
    pieces: 'Bed [[1.8x2.1]] against the living-room wall · wardrobe [[3.2]] · walnut sideboard [[1.6]] under our own painting · reading chair by the window.',
  },
  ldk: {
    style: 'One open pavilion under a [[3.0]] ceiling: kitchen, dining and living together, with sliding glass on two sides opening to the garden and the drive, as in the design renders.',
    light: 'The evening sun comes straight through the glass on the driveway side. Two white dome pendants over the island and a linear light over the table for the tasks; a table lamp, a floor lamp and the strip under the wall cabinets for the evening.',
    pieces: 'Navy L-shaped sofa [[3.9]] with two navy armchairs and a light oak block table · kitchen wall with white tall units, walnut wall cabinets and a steel fridge · island [[1.3x2.2]] with a white waterfall top and three walnut stools · table for six [[2.0x0.95]] · black accent wall.',
  },
  terrace: {
    style: 'The garden side: large pale paving along the glass, an outdoor dining table, and a timber pergola against the dark garage with a lounge and an outdoor kitchen under it.',
    light: 'Long evening light over the lawn from the west. At dusk: wall lights on the pavilion, downlights in the pergola, an uplight in the garden tree.',
    pieces: 'Outdoor table for six [[2.2x0.95]] · pergola [[4.6x3.9]] with a lounge sofa, two armchairs and a teak table · outdoor kitchen with a grill · planted beds along the fences.',
  },
};

// [[2.7]] → "2.7 m" / "8'-10\"" ; [[2.58x1.45]] → "2.58 × 1.45 m" / "8'-6\" × 4'-9\""
export function noteText(str, units) {
  return str.replace(/\[\[([\d.]+)(?:x([\d.]+))?\]\]/g, (_, a, b) => {
    if (units === 'imperial') return b ? `${ftIn(+a)} × ${ftIn(+b)}` : ftIn(+a);
    return b ? `${a} × ${b} m` : `${a} m`;
  });
}

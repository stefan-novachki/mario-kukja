// Which corner each room card sits in, so that neither the closed nor the open card covers the
// room's best view. Chosen from the framing check's picture of each stop (tools/audit-stops.mjs
// measures how much of the important content every corner would hide).
export const CARD_PLACES = {
  landscape: { front: 'tr', hall: 'tr', kid: 'tr', master: 'tl', ensuite: 'bl', guest: 'tr', ldk: 'tr', terrace: 'tl', end: 'bl' },
  portrait: { front: 'tl', hall: 'tl', kid: 'tl', master: 'tl', ensuite: 'tl', guest: 'tl', ldk: 'tl', terrace: 'tl', end: 'tl' },
};

export function cardPlace(id, aspect) {
  return (aspect < 1 ? CARD_PLACES.portrait : CARD_PLACES.landscape)[id] || 'bl';
}

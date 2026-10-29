// Metric / imperial formatting shared by the plan sheet, the room cards and the checks.
export const M_PER_FT = 0.3048;
export const M_PER_IN = 0.0254;

export const toIn = (m) => m / M_PER_IN;
export const toFt = (m) => m / M_PER_FT;
export const m2ToFt2 = (a) => a / (M_PER_FT * M_PER_FT);

// 3.6 -> "11'-10""  (rounded to the nearest inch)
export function ftIn(m) {
  let inches = Math.round(toIn(m));
  const neg = inches < 0;
  inches = Math.abs(inches);
  const ft = Math.floor(inches / 12);
  const i = inches % 12;
  return (neg ? '-' : '') + (ft ? `${ft}'-${i}"` : `${i}"`);
}

export const metres = (m, d = 2) => m.toFixed(d);

export function len(m, units, d = 2) {
  return units === 'imperial' ? ftIn(m) : `${metres(m, d)}`;
}

export function lenU(m, units, d = 2) {
  return units === 'imperial' ? ftIn(m) : `${metres(m, d)} m`;
}

export function area(a, units) {
  return units === 'imperial' ? `${Math.round(m2ToFt2(a))} ft²` : `${a.toFixed(1)} m²`;
}

export function size(w, d, units) {
  return units === 'imperial' ? `${ftIn(w)} × ${ftIn(d)}` : `${w.toFixed(2)} × ${d.toFixed(2)} m`;
}

// Both systems, for the check list: "1.22 m / 48 in"
export function both(m) {
  const inch = toIn(m);
  const imp = inch >= 60 ? `${ftIn(m)}` : `${inch.toFixed(inch < 10 ? 1 : 0)} in`;
  return `${m.toFixed(2)} m / ${imp}`;
}

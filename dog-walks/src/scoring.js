// "Is it a good dog walk?" — a first-pass heuristic. Tune the weights as you learn what you like.
const KIND_SCORE = {
  'Country park': 30,
  'National park': 30,
  Woodland: 26,
  Common: 24,
  Beach: 22,
  'Nature reserve': 18, // often dogs-on-leads or no dogs
  'Dog park': 15, // secure but small
  Park: 10,
};

/**
 * @param {object} spot  from overpass.js
 * @param {number} driveMin  estimated or real drive time
 * @param {number} maxMin  the drive time the user picked
 * @returns {{score:number, reasons:string[], excluded:boolean}}
 */
export function scoreSpot(spot, driveMin, maxMin) {
  const t = spot.tags;
  const reasons = [];
  let score = KIND_SCORE[spot.kind] ?? 10;

  if (t.dog === 'no') return { score: 0, reasons: ['No dogs allowed'], excluded: true };
  if (t.dog === 'yes' || t.dog === 'unleashed') { score += 12; reasons.push('Dogs welcome'); }
  if (t.dog === 'leashed') { score -= 6; reasons.push('Dogs on leads'); }

  // Bigger places make for longer, more varied walks (diminishing returns).
  if (spot.areaKm2 > 0) {
    const sizeBonus = Math.min(20, Math.log10(1 + spot.areaKm2 * 10) * 10);
    score += sizeBonus;
    if (spot.areaKm2 >= 1) reasons.push(`~${spot.areaKm2.toFixed(1)} km² to explore`);
  }

  if (t.access === 'private' || t.access === 'no') return { score: 0, reasons: ['Private'], excluded: true };
  if (t.wikipedia || t.wikidata) { score += 4; reasons.push('Well known'); }
  if (t.fee === 'yes') reasons.push('Entry fee');

  // Closer is better, but only gently — a great spot 40 min away beats a dull one 5 min away.
  score -= (driveMin / maxMin) * 12;

  if (driveMin > maxMin) return { score, reasons, excluded: true };
  return { score: Math.round(score), reasons, excluded: false };
}

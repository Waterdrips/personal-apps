// Real drive times via OpenRouteService (only used when a key is set in Settings).
const ORS_MATRIX = 'https://api.openrouteservice.org/v2/matrix/driving-car';

/**
 * @returns {Promise<(number|null)[]>} minutes from `here` to each spot, null if unreachable
 */
export async function driveTimes(here, spots, apiKey) {
  // Free tier: keep each request to 1 source + 49 destinations.
  const out = [];
  for (let i = 0; i < spots.length; i += 49) {
    const chunk = spots.slice(i, i + 49);
    const res = await fetch(ORS_MATRIX, {
      method: 'POST',
      headers: { Authorization: apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        locations: [[here.lon, here.lat], ...chunk.map((s) => [s.lon, s.lat])],
        sources: [0],
        destinations: chunk.map((_, j) => j + 1),
        metrics: ['duration'],
      }),
    });
    if (!res.ok) throw new Error(`OpenRouteService error ${res.status} — check your key in Settings`);
    const json = await res.json();
    out.push(...json.durations[0].map((s) => (s == null ? null : Math.round(s / 60))));
  }
  return out;
}

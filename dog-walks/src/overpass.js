// Finds candidate walking spots from OpenStreetMap via the Overpass API.
const DEFAULT_URL = 'https://overpass-api.de/api/interpreter';

/**
 * @param {{lat:number, lon:number}} here
 * @param {number} radiusKm
 * @param {string} [endpoint]
 */
export async function findSpots(here, radiusKm, endpoint) {
  const r = Math.round(radiusKm * 1000);
  // Town parks are everywhere, so only look for them close by; bigger places across the whole radius.
  const parkR = Math.min(r, 6000);
  const around = (m) => `(around:${m},${here.lat},${here.lon})`;

  const query = `
    [out:json][timeout:60];
    (
      nwr["leisure"="dog_park"]${around(r)};
      nwr["leisure"="nature_reserve"]["name"]${around(r)};
      nwr["designation"="country_park"]${around(r)};
      nwr["boundary"="national_park"]["name"]${around(r)};
      way["natural"="wood"]["name"]${around(r)};
      relation["natural"="wood"]["name"]${around(r)};
      way["landuse"="forest"]["name"]${around(r)};
      relation["landuse"="forest"]["name"]${around(r)};
      nwr["leisure"="common"]["name"]${around(r)};
      nwr["natural"="beach"]["name"]${around(r)};
      way["leisure"="park"]["name"]${around(parkR)};
      relation["leisure"="park"]["name"]${around(parkR)};
    );
    out tags bb 400;`;

  const url = `${endpoint || DEFAULT_URL}?data=${encodeURIComponent(query)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Overpass error ${res.status} — try again in a minute`);
  const json = await res.json();
  return json.elements.map(toSpot).filter(Boolean);
}

function toSpot(el) {
  const t = el.tags || {};
  let lat = el.lat, lon = el.lon, areaKm2 = 0;
  if (el.bounds) {
    const b = el.bounds;
    lat = (b.minlat + b.maxlat) / 2;
    lon = (b.minlon + b.maxlon) / 2;
    const h = (b.maxlat - b.minlat) * 111;
    const w = (b.maxlon - b.minlon) * 111 * Math.cos((lat * Math.PI) / 180);
    areaKm2 = h * w * 0.6; // bounding boxes overstate area
  }
  if (lat == null) return null;
  return {
    id: `${el.type}/${el.id}`,
    name: t.name || (t.leisure === 'dog_park' ? 'Dog park' : 'Unnamed'),
    kind: kindOf(t),
    lat,
    lon,
    areaKm2,
    tags: t,
  };
}

function kindOf(t) {
  if (t.leisure === 'dog_park') return 'Dog park';
  if (t.boundary === 'national_park') return 'National park';
  if (t.designation === 'country_park') return 'Country park';
  if (t.leisure === 'nature_reserve') return 'Nature reserve';
  if (t.natural === 'beach') return 'Beach';
  if (t.leisure === 'common') return 'Common';
  if (t.natural === 'wood' || t.landuse === 'forest') return 'Woodland';
  return 'Park';
}

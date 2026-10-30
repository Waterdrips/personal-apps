// Finds candidate walking spots from OpenStreetMap via the Overpass API.
// Public Overpass servers are often busy: a timeout comes back as HTTP 200 with an empty
// result and a "remark", so we treat that as a failure and try the next server.
const SERVERS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
];

/**
 * @param {{lat:number, lon:number}} here
 * @param {number} radiusKm
 * @param {string} [customServer]  from Settings; tried first
 * @param {(msg:string)=>void} [onStatus]
 */
export async function findSpots(here, radiusKm, customServer, onStatus = () => {}) {
  const query = buildQuery(here, radiusKm);
  const servers = customServer ? [customServer, ...SERVERS] : SERVERS;
  const errors = [];

  for (const [i, server] of servers.entries()) {
    if (i > 0) onStatus(`Map server busy, trying another (${i + 1}/${servers.length})…`);
    try {
      const res = await fetch(server, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'data=' + encodeURIComponent(query),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (json.remark && /error|timed out|out of memory/i.test(json.remark)) throw new Error(json.remark);
      return { spots: json.elements.map(toSpot).filter(Boolean), raw: json.elements.length };
    } catch (e) {
      errors.push(`${new URL(server).hostname}: ${e.message}`);
    }
  }
  throw new Error(`Couldn't reach the map servers. ${errors.join(' · ')}`);
}

function buildQuery(here, radiusKm) {
  const r = Math.round(radiusKm * 1000);
  // Town parks are everywhere, so only look for them close by; bigger places across the whole radius.
  const parkR = Math.min(r, 6000);
  const around = (m) => `(around:${m},${here.lat},${here.lon})`;
  return `
    [out:json][timeout:90];
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
    )->.all;
    node.all;
    out body;
    (way.all; relation.all;);
    out bb 500;`;
}

function toSpot(el) {
  const t = el.tags || {};
  let lat = el.lat ?? el.center?.lat;
  let lon = el.lon ?? el.center?.lon;
  let areaKm2 = 0;
  if (el.bounds) {
    const b = el.bounds;
    lat ??= (b.minlat + b.maxlat) / 2;
    lon ??= (b.minlon + b.maxlon) / 2;
    const h = (b.maxlat - b.minlat) * 111;
    const w = (b.maxlon - b.minlon) * 111 * Math.cos((lat * Math.PI) / 180);
    areaKm2 = h * w * 0.6; // bounding boxes overstate area
  }
  if (lat == null || lon == null) return null;
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

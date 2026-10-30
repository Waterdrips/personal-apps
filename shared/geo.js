export function getPosition(opts = {}) {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('Location is not available on this device'));
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lon: p.coords.longitude }),
      (e) => reject(new Error(e.message || 'Could not get location')),
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 5 * 60 * 1000, ...opts }
    );
  });
}

/** Straight-line distance in km. */
export function distanceKm(a, b) {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Rough UK drive: roads wind (~1.3× straight line) at ~55 km/h average on A/B roads.
const ROAD_FACTOR = 1.3;
const AVG_KMH = 55;

/** Straight-line radius you can roughly cover in `minutes` of driving. */
export function driveMinutesToKm(minutes) {
  return (minutes / 60) * (AVG_KMH / ROAD_FACTOR);
}

/** Rough drive time in minutes for a straight-line distance. */
export function kmToDriveMinutes(km) {
  return Math.round(((km * ROAD_FACTOR) / AVG_KMH) * 60);
}

export function mapsLink({ lat, lon }, label = '') {
  const q = encodeURIComponent(label ? `${lat},${lon} (${label})` : `${lat},${lon}`);
  return `https://www.google.com/maps/dir/?api=1&destination=${q}`;
}

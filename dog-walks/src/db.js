import { openDb } from '../../shared/db.js';

export const db = openDb('dog-walks', {
  // favourites: a walk you've saved, with your own note and rating
  1: { favourites: 'id, savedAt' },
});

export const SETTINGS = [
  {
    key: 'orsKey',
    label: 'OpenRouteService API key (optional)',
    help: 'Free from openrouteservice.org. With it, results show real drive times instead of estimates.',
    secret: true,
  },
  {
    key: 'overpassUrl',
    label: 'Overpass server (optional)',
    help: 'Leave blank for overpass-api.de.',
    type: 'url',
  },
];

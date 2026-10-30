// UK bank holidays. Calculated locally so it works offline, then topped up from gov.uk
// (which also has one-off holidays like coronations and moved May bank holidays) when online.

export const REGIONS = {
  'england-and-wales': 'England & Wales',
  scotland: 'Scotland',
  'northern-ireland': 'Northern Ireland',
};

const iso = (y, m, d) => new Date(Date.UTC(y, m - 1, d)).toISOString().slice(0, 10);
const dow = (s) => new Date(s + 'T00:00:00Z').getUTCDay(); // 0 Sun … 6 Sat
const addDays = (s, n) => new Date(Date.parse(s + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10);

function easterSunday(y) {
  // Anonymous Gregorian algorithm
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
  return iso(y, month, day);
}

const firstMonday = (y, m) => { let s = iso(y, m, 1); while (dow(s) !== 1) s = addDays(s, 1); return s; };
const lastMonday = (y, m) => { let s = iso(y, m + 1, 0); while (dow(s) !== 1) s = addDays(s, -1); return s; };

/** Fixed-date holidays that fall at a weekend move to the next free weekday. */
function withSubstitutes(dates, taken) {
  const out = [];
  for (const d of dates) {
    let s = d;
    while (dow(s) === 0 || dow(s) === 6 || taken.has(s)) s = addDays(s, 1);
    taken.add(s);
    out.push(s);
  }
  return out;
}

export function calculate(year, region = 'england-and-wales') {
  const easter = easterSunday(year);
  const taken = new Set();
  const days = [addDays(easter, -2), firstMonday(year, 5), lastMonday(year, 5)];

  if (region === 'scotland') {
    days.push(firstMonday(year, 8));
    days.forEach((d) => taken.add(d));
    days.push(...withSubstitutes([iso(year, 1, 1), iso(year, 1, 2)], taken));
    days.push(...withSubstitutes([iso(year, 11, 30)], taken));
  } else {
    days.push(addDays(easter, 1), lastMonday(year, 8));
    days.forEach((d) => taken.add(d));
    days.push(...withSubstitutes([iso(year, 1, 1)], taken));
    if (region === 'northern-ireland') {
      days.push(...withSubstitutes([iso(year, 3, 17)], taken));
      days.push(...withSubstitutes([iso(year, 7, 12)], taken));
    }
  }
  days.push(...withSubstitutes([iso(year, 12, 25), iso(year, 12, 26)], taken));
  return days;
}

/**
 * @param {string} region
 * @param {Record<string,string[]>|null} govuk  cached gov.uk dates by year, for this region
 */
export function holidaySet(region, govuk) {
  const y = new Date().getUTCFullYear();
  const set = new Set();
  for (let year = y - 1; year <= y + 3; year++) {
    // Prefer gov.uk's official list for any year it covers.
    (govuk?.[year] ?? calculate(year, region)).forEach((d) => set.add(d));
  }
  return set;
}

/** Fetches the official list. Returns { year: [dates] } for the region, or null if offline. */
export async function fetchGovUk(region) {
  try {
    const res = await fetch('https://www.gov.uk/bank-holidays.json');
    if (!res.ok) return null;
    const json = await res.json();
    const byYear = {};
    for (const e of json[region]?.events ?? []) (byYear[e.date.slice(0, 4)] ??= []).push(e.date);
    return Object.keys(byYear).length ? byYear : null;
  } catch {
    return null;
  }
}

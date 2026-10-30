// Date and money helpers. Dates are stored as 'YYYY-MM-DD' strings (no time zones to trip over).

/** How often something repeats. `months` covers weeks via `weeks`. */
export const REPEATS = {
  '': { label: "Doesn't repeat", perYear: 0 },
  '1w': { label: 'Weekly', weeks: 1, perYear: 52 },
  '4w': { label: 'Every 4 weeks', weeks: 4, perYear: 13 },
  '1m': { label: 'Monthly', months: 1, perYear: 12 },
  '3m': { label: 'Every 3 months', months: 3, perYear: 4 },
  '6m': { label: 'Every 6 months', months: 6, perYear: 2 },
  '1y': { label: 'Yearly', months: 12, perYear: 1 },
  '2y': { label: 'Every 2 years', months: 24, perYear: 0.5 },
};

export const PERIOD_WORD = { '1w': 'week', '4w': '4 weeks', '1m': 'month', '3m': 'quarter', '6m': '6 months', '1y': 'year', '2y': '2 years' };

export function today() {
  const d = new Date();
  return toStr(new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())));
}

function parse(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function toStr(d) {
  return d.toISOString().slice(0, 10);
}

/** Next occurrence after `date`. Month steps clamp to month end (31 Jan → 28/29 Feb). */
export function addRepeat(date, repeat, originalDay) {
  const r = REPEATS[repeat];
  const d = parse(date);
  if (r.weeks) return toStr(new Date(d.getTime() + r.weeks * 7 * 86400000));
  const day = originalDay ?? d.getUTCDate();
  const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + r.months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));
  return toStr(target);
}

/** Rolls a repeating date forward until it's today or later. */
export function rollForward(date, repeat, originalDay) {
  if (!repeat) return date;
  const t = today();
  let d = date;
  for (let i = 0; d < t && i < 1000; i++) d = addRepeat(d, repeat, originalDay);
  return d;
}

export function daysUntil(date) {
  return Math.round((parse(date) - parse(today())) / 86400000);
}

export function whenText(date) {
  const n = daysUntil(date);
  if (n === 0) return 'Today';
  if (n === 1) return 'Tomorrow';
  if (n === -1) return 'Yesterday';
  if (n < 0) return `${-n} days overdue`;
  if (n < 14) return `In ${n} days`;
  if (n < 60) return `In ${Math.round(n / 7)} weeks`;
  return `In ${Math.round(n / 30.4)} months`;
}

export function niceDate(date) {
  return parse(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

/** Cost of a subscription normalised to per-month and per-year. */
export function costs(price, repeat) {
  const perYear = (Number(price) || 0) * (REPEATS[repeat]?.perYear ?? 0);
  return { perMonth: perYear / 12, perYear };
}

export function money(n, symbol = '£') {
  return `${symbol}${(Math.round(n * 100) / 100).toFixed(2)}`;
}

/** Google Calendar "add event" link, with the repeat rule, for phone reminders. */
export function calendarLink(item) {
  const d = item.due.replace(/-/g, '');
  const end =toStr(new Date(parse(item.due).getTime() + 86400000)).replace(/-/g, '');
  const r = REPEATS[item.repeat];
  const rule = !r?.perYear
    ? ''
    : r.weeks
      ? `RRULE:FREQ=WEEKLY;INTERVAL=${r.weeks}`
      : r.months % 12 === 0
        ? `RRULE:FREQ=YEARLY;INTERVAL=${r.months / 12}`
        : `RRULE:FREQ=MONTHLY;INTERVAL=${r.months}`;
  const p = new URLSearchParams({
    action: 'TEMPLATE',
    text: item.kind === 'sub' ? `${item.name} renews` : item.name,
    dates: `${d}/${end}`,
    details: item.notes || '',
  });
  if (rule) p.set('recur', rule);
  return `https://calendar.google.com/calendar/render?${p}`;
}

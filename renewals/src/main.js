import '../../shared/ui.css';
import { initTabs, esc } from '../../shared/shell.js';
import { openDb } from '../../shared/db.js';
import { renderSettings, getSetting } from '../../shared/settings.js';
import {
  REPEATS, PERIOD_WORD, MONTH_NAMES, today, addRepeat, rollForward, daysUntil, whenText, niceDate, costs, money,
  calendarLink, dueWithin, monthsLabel, WORKDAY_RULES, setHolidays, payDate, adjust,
} from './dates.js';
import { REGIONS, holidaySet, fetchGovUk } from './holidays.js';

document.documentElement.style.setProperty('--accent', '#3b5b92');

// kind: 'due' (MOT, insurance…) or 'sub' (subscription with a price)
// due: next date (YYYY-MM-DD), repeat: key of REPEATS, day: day-of-month anchor for monthly repeats
const db = openDb('renewals', { 1: { items: '++id, kind, due, category' } });

const SETTINGS = [
  { key: 'currency', label: 'Currency symbol', help: 'Defaults to £.' },
  {
    key: 'region',
    label: 'Bank holidays',
    options: REGIONS,
    default: 'england-and-wales',
    help: 'Used for “next working day” payments like mortgages and Direct Debits.',
  },
];

const $ = (s) => document.querySelector(s);
const editor = $('#editor');
const form = $('#form');
const F = form.elements;
let editingId = null;
let symbol = '£';

// Fill the repeat / billing dropdowns.
F.repeat.innerHTML = Object.entries(REPEATS).map(([k, r]) => `<option value="${k}">${r.label}</option>`).join('');
F.billing.innerHTML = Object.entries(REPEATS)
  .filter(([k]) => k)
  .map(([k, r]) => `<option value="${k}" ${k === '1m' ? 'selected' : ''}>${r.label}</option>`)
  .join('');

F.workday.innerHTML = Object.entries(WORKDAY_RULES).map(([k, l]) => `<option value="${k}">${l}</option>`).join('');

$('#month-grid').innerHTML = MONTH_NAMES.map(
  (m, i) => `<label class="month"><input type="checkbox" name="months" value="${i + 1}" checked /><span>${m}</span></label>`
).join('');
const monthBoxes = () => [...form.querySelectorAll('input[name="months"]')];
const pickedMonths = () => monthBoxes().filter((b) => b.checked).map((b) => Number(b.value));

initTabs({
  upcoming: renderUpcoming,
  subs: renderSubs,
  settings: () => renderSettings($('[data-panel="settings"]'), db, SETTINGS, 'renewals'),
});

init();

async function init() {
  symbol = (await getSetting(db, 'currency')) || '£';
  await loadHolidays();
  await renewPastSubscriptions();
  refresh();
  // Top up with the official gov.uk list in the background (handles one-off holidays).
  const region = await currentRegion();
  const official = await fetchGovUk(region);
  if (official) {
    await db.settings.put({ key: `govuk:${region}`, value: official });
    await loadHolidays();
    refresh();
  }
}

async function currentRegion() {
  return (await getSetting(db, 'region')) || 'england-and-wales';
}

async function loadHolidays() {
  const region = await currentRegion();
  const cached = (await db.settings.get(`govuk:${region}`))?.value ?? null;
  setHolidays(holidaySet(region, cached));
}

/** "Mon 2 Nov 2026" plus a note when the date was moved for a weekend/bank holiday. */
function dateText(i) {
  const pay = payDate(i);
  return pay === i.due ? niceDate(pay) : `${niceDate(pay)} (moved from ${niceDate(i.due).replace(/ \d{4}$/, '')})`;
}

/** Subscriptions renew on their own, so move any past renewal dates on to the next one. */
async function renewPastSubscriptions() {
  const t = today();
  const past = await db.items.where('kind').equals('sub').filter((i) => payDate(i) < t).toArray();
  for (const i of past) await db.items.update(i.id, { due: rollForward(i.due, i.repeat, i.day, i.months, i.workday) });
}

function refresh() {
  renderUpcoming();
  renderSubs();
}

// ---------- Coming up ----------

async function renderUpcoming() {
  const items = (await db.items.toArray())
    .map((i) => ({ ...i, pay: payDate(i) }))
    .sort((a, b) => (a.pay < b.pay ? -1 : 1));
  const el = $('#upcoming');
  if (!items.length) {
    el.innerHTML = `<p class="muted">Nothing here yet. Tap <strong>+</strong> to add an MOT, insurance renewal, or a subscription.</p>`;
    return;
  }
  const groups = [
    ['Overdue', items.filter((i) => daysUntil(i.pay) < 0)],
    ['Next 30 days', items.filter((i) => daysUntil(i.pay) >= 0 && daysUntil(i.pay) <= 30)],
    ['Later', items.filter((i) => daysUntil(i.pay) > 30)],
  ].filter(([, list]) => list.length);

  el.innerHTML = groups
    .map(([title, list]) => `<h2>${title}</h2>${list.map(rowHtml).join('')}`)
    .join('');
  bindRows(el);
}

function rowHtml(i) {
  const n = daysUntil(i.pay);
  const tone = n < 0 ? 'overdue' : n <= 7 ? 'soon' : '';
  const price = i.kind === 'sub' ? ` · ${money(i.price, symbol)}` : '';
  const done = i.kind === 'due' ? `<button class="ghost small-btn" data-done="${i.id}">${i.repeat ? 'Done ↻' : 'Done'}</button>` : '';
  return `
    <article class="card item ${tone}" data-edit="${i.id}">
      <span class="grow">
        <strong>${esc(i.name)}</strong>
        <small>${whenText(i.pay)} · ${dateText(i)}${price}${i.category ? ` · ${esc(i.category)}` : ''}</small>
      </span>
      ${done}
    </article>`;
}

function bindRows(el) {
  el.querySelectorAll('[data-edit]').forEach((row) =>
    row.addEventListener('click', (e) => {
      if (e.target.closest('[data-done]')) return;
      openEditor(Number(row.dataset.edit));
    })
  );
  el.querySelectorAll('[data-done]').forEach((b) =>
    b.addEventListener('click', async () => {
      const item = await db.items.get(Number(b.dataset.done));
      if (item.repeat) {
        // Roll on from the due date (not today), so the MOT stays on its usual date.
        let next = addRepeat(item.due, item.repeat, item.day, item.months);
        if (adjust(next, item.workday) < today()) next = rollForward(next, item.repeat, item.day, item.months, item.workday);
        await db.items.update(item.id, { due: next });
      } else if (confirm(`Mark “${item.name}” done and remove it?`)) {
        await db.items.delete(item.id);
      }
      refresh();
    })
  );
}

// ---------- Subscriptions ----------

async function renderSubs() {
  const subs = await db.items.where('kind').equals('sub').toArray();
  const withCost = subs
    .map((s) => ({ ...s, ...costs(s.price, s.repeat, s.months) }))
    .sort((a, b) => b.perYear - a.perYear);

  const perMonth = withCost.reduce((t, s) => t + s.perMonth, 0);
  const perYear = withCost.reduce((t, s) => t + s.perYear, 0);
  const next30 = withCost.reduce((t, s) => t + dueWithin(s, 30), 0);

  $('#totals').innerHTML = `
    <div><small>Next 30 days</small><strong>${money(next30, symbol)}</strong></div>
    <div><small>Avg / month</small><strong>${money(perMonth, symbol)}</strong></div>
    <div><small>Per year</small><strong>${money(perYear, symbol)}</strong></div>`;

  const byCat = {};
  for (const s of withCost) byCat[s.category || 'Other'] = (byCat[s.category || 'Other'] ?? 0) + s.perMonth;
  const cats = Object.entries(byCat).sort((a, b) => b[1] - a[1]);

  const el = $('#subs');
  if (!subs.length) {
    el.innerHTML = `<p class="muted">No subscriptions yet. Tap <strong>+</strong>, choose <em>Subscription</em>, and enter the price per month or per year.</p>`;
    return;
  }
  el.innerHTML = `
    ${cats.length > 1 ? `<div class="chips">${cats.map(([c, m]) => `<span class="chip">${esc(c)} ${money(m, symbol)}/mo</span>`).join('')}</div>` : ''}
    ${withCost
      .map(
        (s) => `
      <article class="card item" data-edit="${s.id}">
        <span class="grow">
          <strong>${esc(s.name)}</strong>
          <small>${money(s.price, symbol)} per ${PERIOD_WORD[s.repeat]}${monthsLabel(s.months) ? ` (${monthsLabel(s.months)})` : ''} · next ${dateText(s)}</small>
        </span>
        <span class="right">
          <strong>${money(s.perMonth, symbol)}</strong><small>/month</small>
          <small>${money(s.perYear, symbol)}/yr</small>
        </span>
      </article>`
      )
      .join('')}`;
  bindRows(el);
}

// ---------- Editor ----------

$('#add').addEventListener('click', () => openEditor(null));
$('#cancel').addEventListener('click', () => editor.close());
form.addEventListener('change', syncForm);
form.addEventListener('input', syncForm);

async function openEditor(id) {
  editingId = id;
  form.reset();
  const item = id ? await db.items.get(id) : null;
  const kind = item?.kind ?? (location.hash === '#subs' ? 'sub' : 'due');
  F.kind.value = kind;
  F.title.value = item?.name ?? '';
  F.due.value = item?.due ?? today();
  F.category.value = item?.category ?? '';
  F.notes.value = item?.notes ?? '';
  F.price.value = item?.price ?? '';
  F.workday.value = item?.workday ?? (kind === 'sub' ? 'next' : '');
  if (kind === 'sub') F.billing.value = item?.repeat || '1m';
  else F.repeat.value = item?.repeat ?? '1y';
  const months = item?.months?.length ? item.months : null;
  monthBoxes().forEach((b) => (b.checked = !months || months.includes(Number(b.value))));
  $('#months-box').open = !!months;

  const cats = [...new Set((await db.items.toArray()).map((i) => i.category).filter(Boolean))];
  $('#categories').innerHTML = cats.map((c) => `<option value="${esc(c)}">`).join('');

  $('#delete').hidden = !id;
  const cal = $('#calendar');
  cal.hidden = !item;
  if (item) cal.href = calendarLink(item);

  syncForm();
  editor.showModal();
  if (!id) F.title.focus();
}

function syncForm() {
  const isSub = F.kind.value === 'sub';
  form.querySelectorAll('.sub-only').forEach((e) => (e.hidden = !isSub));
  form.querySelectorAll('.due-only').forEach((e) => (e.hidden = isSub));
  $('#months-box').hidden = !(isSub && F.billing.value === '1m');
  F.price.required = isSub;
  $('#date-label').textContent = isSub ? 'Next payment' : 'Due on';
  const pv = $('#pay-preview');
  const due = F.due.value;
  const pay = due ? adjust(due, F.workday.value) : due;
  pv.textContent = due && pay !== due ? `That's a non-working day, so it'll show as ${niceDate(pay)}.` : '';
  const preview = $('#cost-preview');
  if (isSub && Number(F.price.value) > 0) {
    const months = F.billing.value === '1m' ? pickedMonths() : null;
    const c = costs(F.price.value, F.billing.value, months);
    const partial = months && months.length < 12;
    preview.textContent = partial
      ? `${months.length} payments a year = ${money(c.perYear, symbol)} a year · averages ${money(c.perMonth, symbol)} a month`
      : `= ${money(c.perMonth, symbol)} a month · ${money(c.perYear, symbol)} a year`;
  } else preview.textContent = '';
}

form.addEventListener('submit', async (e) => {
  if (e.submitter?.value !== 'save') return;
  e.preventDefault();
  if (!form.reportValidity()) return;
  const isSub = F.kind.value === 'sub';
  const repeat = isSub ? F.billing.value : F.repeat.value;
  const due = F.due.value;
  const existing = editingId ? await db.items.get(editingId) : null;
  // Keep a month-end anchor (e.g. the 31st) unless the date itself was changed.
  const day = existing && existing.due === due ? existing.day : Number(due.slice(8));
  const picked = pickedMonths();
  if (isSub && repeat === '1m' && !picked.length) {
    alert('Pick at least one month.');
    return;
  }
  const months = isSub && repeat === '1m' && picked.length < 12 ? picked : null;
  const data = {
    kind: F.kind.value,
    name: F.title.value.trim(),
    due: isSub ? rollForward(due, repeat, day, months, F.workday.value) : due,
    repeat,
    day,
    months,
    workday: F.workday.value,
    price: isSub ? Number(F.price.value) : null,
    category: F.category.value.trim(),
    notes: F.notes.value.trim(),
  };
  if (editingId) await db.items.update(editingId, data);
  else await db.items.add(data);
  editor.close();
  refresh();
});

$('#delete').addEventListener('click', async () => {
  if (!editingId || !confirm('Delete this?')) return;
  await db.items.delete(editingId);
  editor.close();
  refresh();
});

// Pick up changed settings (currency, bank-holiday region) when leaving Settings.
let lastRegion = null;
addEventListener('hashchange', async () => {
  const s = (await getSetting(db, 'currency')) || '£';
  const region = await currentRegion();
  if (s !== symbol || region !== lastRegion) {
    symbol = s;
    if (lastRegion && region !== lastRegion) {
      const official = await fetchGovUk(region);
      if (official) await db.settings.put({ key: `govuk:${region}`, value: official });
    }
    lastRegion = region;
    await loadHolidays();
    refresh();
  }
});

// Tiny tab shell: <nav data-tabs> with <button data-view="x"> and <section data-panel="x">.
// The active tab is kept in the URL hash so the back button works.
export function initTabs(onShow = {}) {
  const buttons = [...document.querySelectorAll('[data-view]')];
  const panels = [...document.querySelectorAll('[data-panel]')];

  function show(name) {
    if (!panels.some((p) => p.dataset.panel === name)) name = panels[0].dataset.panel;
    panels.forEach((p) => (p.hidden = p.dataset.panel !== name));
    buttons.forEach((b) => b.setAttribute('aria-current', String(b.dataset.view === name)));
    onShow[name]?.();
  }

  buttons.forEach((b) => b.addEventListener('click', () => (location.hash = b.dataset.view)));
  addEventListener('hashchange', () => show(location.hash.slice(1)));
  show(location.hash.slice(1));
}

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

/* Reusable UI: helpers, validation, toast, modal, SearchableDropdown, dataTable */
const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const money = n => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(n || 0);
const fdate = d => new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ic = n => `<i class="fa-solid fa-${n}" aria-hidden="true"></i>`;
const badge = s => `<span class="badge b-${String(s).toLowerCase().replace(/\s/g, '')}">${esc(s)}</span>`;
const opts = a => a.map(x => ({ value: x, label: x }));

/* Validation */
const validateRequired = (v, l = 'This field') => String(v ?? '').trim() ? '' : `${l} is required`;
const validateEmail = v => !v || /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) ? '' : 'Enter a valid email address';
const validatePhone = v => !v || /^[6-9]\d{9}$/.test(v) ? '' : 'Enter a valid 10-digit mobile number';
const validateAmount = (v, l = 'Amount') => {
  if (v === '' || v == null) return `${l} is required`;
  if (!/^\d+(\.\d{1,2})?$/.test(v)) return 'Enter a valid number with up to 2 decimals';
  return +v > 0 ? '' : `${l} must be greater than zero`;
};
const validateAccountNumber = v => !v || /^\d{9,18}$/.test(v) ? '' : 'Account number must be 9 to 18 digits';
const validateIFSC = v => !v || /^[A-Z]{4}0[A-Z0-9]{6}$/.test(v) ? '' : 'Enter a valid IFSC code, for example DEMO0123456';
const validatePassword = v => !v || /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(v) ? '' : 'Use 8+ characters with upper case, lower case and a number';
const validateName = (v, l) => !v || /^[A-Za-z][A-Za-z .'-]{1,59}$/.test(v) ? '' : `${l} must contain letters only (2 to 60 characters)`;
const minLen = n => (v, l) => !v || v.length >= n ? '' : `${l} must be at least ${n} characters`;
const maxLen = n => (v, l) => !v || v.length <= n ? '' : `${l} must be at most ${n} characters`;
const validateDate = v => !v || !isNaN(new Date(v)) ? '' : 'Enter a valid date';
function showFieldError(el, m) { const f = el.closest('.fld'); f.classList.add('bad'); f.classList.remove('good'); $('.err', f).textContent = m; }
function clearFieldError(el) { const f = el.closest('.fld'); f.classList.remove('bad'); f.classList.add('good'); $('.err', f).textContent = ''; }
/* fields: [{k, l, rules:[fn(v,label,all)]}]; returns values or null */
function validateForm(root, fields) {
  let ok = true; const vals = {};
  fields.forEach(f => {
    const el = $(`[data-f="${f.k}"]`, root); if (!el) return;
    const v = el.classList.contains('sd') ? (el.dataset.value || '') : el.value.trim(); vals[f.k] = v;
    let m = ''; for (const r of f.rules || []) { m = r(v, f.l, vals); if (m) break; }
    if (m) { showFieldError(el, m); ok = false; } else clearFieldError(el);
  });
  return ok ? vals : null;
}

/* Toast */
function toast(type, msg) {
  let box = $('#toasts'); if (!box) { box = document.createElement('div'); box.id = 'toasts'; box.setAttribute('aria-live', 'polite'); document.body.append(box); }
  const icon = { success: 'circle-check', error: 'circle-xmark', warning: 'triangle-exclamation', info: 'circle-info' }[type];
  const t = document.createElement('div'); t.className = 'toast t-' + type;
  t.innerHTML = `${ic(icon)}<span>${esc(msg)}</span><button class="icon-btn" aria-label="Close">${ic('xmark')}</button>`;
  const close = () => { t.classList.add('out'); setTimeout(() => t.remove(), 200); };
  $('button', t).onclick = close; box.append(t); setTimeout(close, 4500);
}

/* Modal */
let _modal = null;
function closeModal() { if (!_modal) return; _modal.el.remove(); document.body.classList.remove('lock'); document.removeEventListener('keydown', _modal.key); _modal.prev && _modal.prev.focus(); _modal = null; }
function openModal({ title, body, actions = [], wide = false }) {
  closeModal();
  const el = document.createElement('div'); el.className = 'modal-bg';
  el.innerHTML = `<div class="modal ${wide ? 'wide' : ''}" role="dialog" aria-modal="true" aria-label="${esc(title)}" tabindex="-1">
    <div class="modal-h"><h3>${esc(title)}</h3><button class="icon-btn" data-x aria-label="Close">${ic('xmark')}</button></div>
    <div class="modal-b">${body}</div><div class="modal-f"></div></div>`;
  const f = $('.modal-f', el);
  actions.forEach(a => { const b = document.createElement('button'); b.className = 'btn ' + (a.cls || 'btn-ghost'); b.textContent = a.label;
    b.onclick = async () => { b.classList.add('loading'); try { if (await a.onClick(el) !== false && !a.keep) closeModal(); } finally { b.classList.remove('loading'); } }; f.append(b); });
  el.addEventListener('mousedown', e => { if (e.target === el) closeModal(); });
  $('[data-x]', el).onclick = closeModal;
  const key = e => { if (e.key === 'Escape') closeModal(); };
  document.addEventListener('keydown', key);
  _modal = { el, key, prev: document.activeElement }; document.body.append(el); document.body.classList.add('lock');
  ($('input:not([readonly])', el) || $('.modal', el)).focus(); return el;
}
const confirmDialog = (title, msg, label, cb) => openModal({ title, body: `<p class="muted">${esc(msg)}</p>`, actions: [{ label: 'Cancel' }, { label, cls: 'btn-danger', onClick: cb }] });

/* SearchableDropdown: items are {value,label,sub?}. Value is exposed as el.dataset.value */
class SearchableDropdown {
  constructor(el, o) {
    this.el = el; this.o = Object.assign({ placeholder: 'Select', data: [], onChange() {}, disabled: false, value: '' }, o);
    this.idx = -1; el.classList.add('sd');
    el.innerHTML = `<button type="button" class="sd-btn" aria-haspopup="listbox"><span class="sd-t"></span><span class="sd-x" role="button" aria-label="Clear">${ic('xmark')}</span>${ic('chevron-down')}</button>
      <div class="sd-menu" hidden><input class="sd-q" placeholder="Search" aria-label="Search options"><ul role="listbox"></ul></div>`;
    this.btn = $('.sd-btn', el); this.menu = $('.sd-menu', el); this.q = $('.sd-q', el); this.ul = $('ul', el);
    this.btn.onclick = e => { if (e.target.closest('.sd-x')) { this.set(''); return; } this.menu.hidden ? this.open() : this.close(); };
    this.btn.onkeydown = e => { if (['ArrowDown', 'Enter', ' '].includes(e.key)) { e.preventDefault(); this.open(); } };
    this.q.oninput = () => this.render();
    this.q.onkeydown = e => {
      const n = $$('li:not(.none)', this.ul);
      if (e.key === 'ArrowDown') { e.preventDefault(); this.idx = Math.min(n.length - 1, this.idx + 1); this.hl(n); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); this.idx = Math.max(0, this.idx - 1); this.hl(n); }
      else if (e.key === 'Enter') { e.preventDefault(); if (n[this.idx]) this.pick(n[this.idx].dataset.v); }
      else if (e.key === 'Escape') { e.stopPropagation(); this.close(); this.btn.focus(); }
    };
    this.ul.onclick = e => { const li = e.target.closest('li[data-v]'); if (li) this.pick(li.dataset.v); };
    this.out = e => { if (!el.contains(e.target)) this.close(); };
    document.addEventListener('mousedown', this.out);
    this.setDisabled(this.o.disabled); this.set(this.o.value, true);
  }
  setData(d) { this.o.data = d; this.set(this.el.dataset.value || '', true); }
  setDisabled(d) { this.btn.disabled = d; this.el.classList.toggle('disabled', d); }
  hl(n) { n.forEach((li, i) => li.classList.toggle('hl', i === this.idx)); n[this.idx] && n[this.idx].scrollIntoView({ block: 'nearest' }); }
  render() {
    const t = this.q.value.toLowerCase(), cur = this.el.dataset.value;
    const r = this.o.data.filter(d => (d.label + ' ' + (d.sub || '')).toLowerCase().includes(t));
    this.ul.innerHTML = r.length ? r.map(d => `<li role="option" data-v="${esc(d.value)}" class="${d.value === cur ? 'sel' : ''}">${esc(d.label)}${d.sub ? `<small>${esc(d.sub)}</small>` : ''}</li>`).join('') : '<li class="none">No results found</li>';
    this.idx = r.length ? 0 : -1; this.hl($$('li[data-v]', this.ul));
  }
  open() { if (this.btn.disabled) return; this.menu.hidden = false; this.q.value = ''; this.render(); this.q.focus(); }
  close() { this.menu.hidden = true; }
  pick(v) { this.set(v); this.close(); this.btn.focus(); }
  set(v, silent) {
    const it = this.o.data.find(d => String(d.value) === String(v)); this.el.dataset.value = it ? it.value : '';
    const t = $('.sd-t', this.el); t.textContent = it ? it.label : this.o.placeholder; t.classList.toggle('ph', !it);
    this.el.classList.toggle('has', !!it); if (!silent) this.o.onChange(it || null);
  }
}

/* dataTable: search, filter dropdown, sort, pagination, empty/loading states */
function dataTable(host, c) {
  let q = window.GQ || '', page = 1, size = 8, sk = null, sd = 1, fv = '';
  window.GQ = '';
  host.innerHTML = `<div class="toolbar"><div class="search">${ic('magnifying-glass')}<input type="search" placeholder="Search" aria-label="Search" value="${esc(q)}"></div>
    <div class="sd tb-f" ${c.filter ? '' : 'hidden'}></div><div class="grow"></div>${c.toolbar || ''}</div>
    <div class="card flush"><div class="table-wrap"></div><div class="pager"></div></div>`;
  const wrap = $('.table-wrap', host), pager = $('.pager', host);
  if (c.filter) new SearchableDropdown($('.tb-f', host), { placeholder: c.filter.label, data: c.filter.options, onChange: i => { fv = i ? i.value : ''; page = 1; draw(); } });
  $('.search input', host).oninput = e => { q = e.target.value.toLowerCase(); page = 1; draw(); };
  function draw() {
    let rows = c.rows();
    if (fv) rows = rows.filter(r => r[c.filter.key] === fv);
    if (q) rows = rows.filter(r => JSON.stringify(r).toLowerCase().includes(q.toLowerCase()));
    if (sk) rows = [...rows].sort((a, b) => (a[sk] > b[sk] ? 1 : a[sk] < b[sk] ? -1 : 0) * sd);
    const pages = Math.max(1, Math.ceil(rows.length / size)); page = Math.min(page, pages);
    if (!rows.length) { wrap.innerHTML = `<div class="empty">${ic(c.icon || 'inbox')}<h4>${esc(c.empty || 'No records found')}</h4><p>Try changing your search or filters.</p></div>`; pager.innerHTML = ''; return; }
    const part = rows.slice((page - 1) * size, page * size);
    wrap.innerHTML = `<table><thead><tr>${c.cols.map(k => `<th data-k="${k.k}" class="${k.sort === false ? '' : 'sortable'}">${k.l}${sk === k.k ? ic(sd > 0 ? 'arrow-up' : 'arrow-down') : ''}</th>`).join('')}${c.actions ? '<th class="r">Actions</th>' : ''}</tr></thead>
      <tbody>${part.map((r, i) => `<tr data-i="${i}">${c.cols.map(k => `<td data-label="${k.l}">${k.fmt ? k.fmt(r[k.k], r) : esc(r[k.k])}</td>`).join('')}${c.actions ? `<td class="r acts" data-label="Actions">${c.actions(r)}</td>` : ''}</tr>`).join('')}</tbody></table>`;
    $$('th.sortable', wrap).forEach(th => th.onclick = () => { sd = sk === th.dataset.k ? -sd : 1; sk = th.dataset.k; draw(); });
    $$('[data-act]', wrap).forEach(b => b.onclick = () => c.onAction(b.dataset.act, part[+b.closest('tr').dataset.i]));
    pager.innerHTML = `<span class="muted">${(page - 1) * size + 1}-${Math.min(page * size, rows.length)} of ${rows.length}</span><div class="pg">
      <button class="icon-btn" ${page < 2 ? 'disabled' : ''} data-p="-1" aria-label="Previous page">${ic('chevron-left')}</button><span>Page ${page} of ${pages}</span>
      <button class="icon-btn" ${page >= pages ? 'disabled' : ''} data-p="1" aria-label="Next page">${ic('chevron-right')}</button></div>`;
    $$('[data-p]', pager).forEach(b => b.onclick = () => { page += +b.dataset.p; draw(); });
  }
  wrap.innerHTML = '<div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div>';
  setTimeout(draw, 250);
  return draw;
}

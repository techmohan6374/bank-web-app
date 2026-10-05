/* App: auth, layout, routing, pages, charts. Data access goes only through storage.js */
const NAV = [
  ['dashboard', 'Dashboard', 'gauge-high', 'customer employee admin'], ['customers', 'Customers', 'users', 'employee admin'],
  ['accounts', 'Accounts', 'building-columns', 'customer employee admin'], ['transfer', 'Fund Transfer', 'arrow-right-arrow-left', 'customer'],
  ['beneficiaries', 'Beneficiaries', 'address-book', 'customer'], ['transactions', 'Transactions', 'receipt', 'customer employee admin'],
  ['suspicious', 'Suspicious Activity', 'triangle-exclamation', 'employee'], ['employees', 'Employees', 'id-badge', 'admin'],
  ['roles', 'Roles & Permissions', 'user-shield', 'admin'], ['reports', 'Reports', 'chart-column', 'employee admin'],
  ['audit', 'Audit Logs', 'clipboard-list', 'admin'], ['notifications', 'Notifications', 'bell', 'customer admin'], ['settings', 'Settings', 'gear', 'admin']];
const ROLE_NAME = { customer: 'Customer', employee: 'Bank Employee', admin: 'Administrator' };
const session = () => { const s = getData(K.session); return s && s.expires > Date.now() ? s : null; };
const can = p => { const s = session(); const r = (getData(K.roles) || []).find(x => x.id === s.role); return !!r && r.perms.includes(p); };
const settings = () => getData(K.settings);
function audit(action, module, entity, details = '') {
  const s = session(); insertData(K.audit_logs, { user: s ? s.name : 'System', action, module, entity, details, timestamp: new Date().toISOString() });
}
function notify(type, message, scope = 'all') { insertData(K.notifications, { type, title: type, message, read: false, date: new Date().toISOString(), scope }); }

/* Scoped data: customers only see their own records */
const isCust = () => session().role === 'customer';
const myAccounts = () => { const a = getData(K.accounts); return isCust() ? a.filter(x => x.customerId === session().customerId) : a; };
const custName = id => (getData(K.customers).find(c => c.id === id) || {}).name || '-';
const accLabel = id => { const a = getData(K.accounts).find(x => x.id === id); return a ? '****' + a.number.slice(-4) + ' ' + a.type : '-'; };
const myTxns = () => { const ids = myAccounts().map(a => a.id); return getData(K.transactions).filter(t => ids.includes(t.accountId)).map(t => ({ ...t, account: accLabel(t.accountId), customer: custName((getData(K.accounts).find(a => a.id === t.accountId) || {}).customerId) })); };

/* Auth */
function renderLogin() {
  $('#app').innerHTML = `<div class="login"><div class="login-side"><div class="brand">${ic('building-columns')}<span>${esc(settings().bankName)}</span></div>
    <h1>Banking that stays out of your way.</h1><p>Manage accounts, move money and review activity from one secure workspace.</p>
    <p class="demo">Demo accounts: customer@bank.demo / Customer@123, employee@bank.demo / Employee@123, admin@bank.demo / Admin@123</p></div>
    <form class="login-form" novalidate><h2>Sign in</h2><div id="lerr" class="alert" hidden></div>
    <div class="fld"><label for="lu">Email / Username</label><input id="lu" data-f="u" autocomplete="username"><div class="err"></div></div>
    <div class="fld"><label for="lp">Password</label><div class="pw"><input id="lp" data-f="p" type="password" autocomplete="current-password"><button type="button" class="icon-btn" aria-label="Show password">${ic('eye')}</button></div><div class="err"></div></div>
    <label class="check"><input type="checkbox" id="lr"> Remember me</label><button class="btn btn-primary block" type="submit">Sign in</button>
    <p class="note">Prototype only. LocalStorage is not a secure authentication mechanism.</p></form></div>`;
  const f = $('.login-form'); $('.pw button').onclick = e => { const i = $('#lp'); i.type = i.type === 'password' ? 'text' : 'password'; e.currentTarget.innerHTML = ic(i.type === 'password' ? 'eye' : 'eye-slash'); };
  f.onsubmit = e => {
    e.preventDefault(); const v = validateForm(f, [{ k: 'u', l: 'Email or username', rules: [validateRequired] }, { k: 'p', l: 'Password', rules: [validateRequired, minLen(6)] }]); if (!v) return;
    const b = $('.btn', f); b.classList.add('loading');
    setTimeout(() => {
      const u = getData(K.users).find(x => x.username.toLowerCase() === v.u.toLowerCase() && x.password === v.p);
      if (!u) { b.classList.remove('loading'); const a = $('#lerr'); a.hidden = false; a.textContent = 'Invalid credentials. Check your email and password and try again.'; return; }
      saveData(K.session, { userId: u.id, name: u.name, role: u.role, customerId: u.customerId, expires: Date.now() + ($('#lr').checked ? 7 : 1) * 864e5 });
      audit('Login', 'Authentication', u.username); location.hash = '#/dashboard'; boot();
    }, 700);
  };
}
function logout() { audit('Logout', 'Authentication', session().name); removeData(K.session); location.hash = ''; boot(); }

/* Shell */
function renderShell() {
  const s = session(), items = NAV.filter(n => n[3].includes(s.role));
  $('#app').innerHTML = `<div class="shell"><aside class="side" id="side"><div class="brand">${ic('building-columns')}<span>${esc(settings().bankName)}</span></div>
    <nav>${items.map(n => `<a href="#/${n[0]}" data-r="${n[0]}" title="${n[1]}">${ic(n[2])}<span>${n[1]}</span></a>`).join('')}</nav>
    <button class="side-out" id="lo" title="Logout">${ic('right-from-bracket')}<span>Logout</span></button></aside><div class="scrim" id="scrim"></div>
    <div class="main"><header class="top"><button class="icon-btn" id="burger" aria-label="Toggle menu">${ic('bars')}</button>
      <div class="ttl"><h1 id="pt"></h1><div class="crumb" id="bc"></div></div>
      <div class="search hs">${ic('magnifying-glass')}<input id="gs" type="search" placeholder="Search transactions" aria-label="Global search"></div><div class="grow"></div>
      <a class="icon-btn bell" href="#/notifications" aria-label="Notifications">${ic('bell')}<i class="dot" id="dot" hidden></i></a>
      <div class="user"><span class="av">${esc(s.name[0])}</span><div><b>${esc(s.name)}</b><small>${ROLE_NAME[s.role]}</small></div></div></header>
      <main id="view" tabindex="-1"></main><footer>Prototype build. Data is stored in this browser only.</footer></div></div>`;
  $('#burger').onclick = () => { if (innerWidth > 1024) $('.shell').classList.toggle('collapsed'); else $('#side').classList.toggle('open'); $('#scrim').classList.toggle('on', $('#side').classList.contains('open')); setTimeout(resizeAllCharts, 250); };
  $('#scrim').onclick = () => { $('#side').classList.remove('open'); $('#scrim').classList.remove('on'); };
  $('#lo').onclick = logout;
  $('#gs').onkeydown = e => { if (e.key === 'Enter') { window.GQ = e.target.value; location.hash = '#/transactions'; route(); } };
}

/* Charts (ECharts) */
const charts = {};
function createChart(id, option) {
  const el = document.getElementById(id); if (!el) return;
  if (!option) { el.innerHTML = `<div class="empty small">${ic('chart-simple')}<p>No data to display</p></div>`; return; }
  destroyChart(id); const c = echarts.init(el); c.setOption(option); charts[id] = c; return c;
}
const updateChart = (c, o) => c && c.setOption(o, true);
function destroyChart(id) { if (charts[id]) { charts[id].dispose(); delete charts[id]; } }
const resizeAllCharts = () => Object.values(charts).forEach(c => c.resize());
const resizeCharts = resizeAllCharts;
const destroyAllCharts = () => Object.keys(charts).forEach(destroyChart);
addEventListener('resize', () => resizeCharts());
const PAL = ['#1352C8', '#3F8CFF', '#0E9F8E', '#F2A33A', '#8A94A6', '#D14B5A'];
const base = { color: PAL, textStyle: { fontFamily: 'Inter, sans-serif' }, grid: { left: 8, right: 12, top: 36, bottom: 8, containLabel: true }, tooltip: { trigger: 'axis' }, legend: { top: 0, type: 'scroll' } };
const donut = d => d.length ? { ...base, tooltip: { trigger: 'item' }, legend: { bottom: 0, type: 'scroll' }, series: [{ type: 'pie', radius: ['48%', '70%'], center: ['50%', '45%'], label: { show: false }, data: d }] } : null;

function initDashboardCharts() {
  const tx = myTxns(), ok = tx.filter(t => t.status === 'Success'), months = [];
  for (let i = 5; i >= 0; i--) { const d = new Date(); d.setMonth(d.getMonth() - i); months.push(d.toISOString().slice(0, 7)); }
  const sum = (m, f) => ok.filter(t => t.date.startsWith(m) && f(t)).reduce((a, t) => a + t.amount, 0);
  const inc = months.map(m => sum(m, t => t.type === 'Credit')), exp = months.map(m => sum(m, t => t.type !== 'Credit'));
  const mn = months.map(m => new Date(m + '-01').toLocaleString('en', { month: 'short' }));
  createChart('c1', tx.length ? { ...base, xAxis: { type: 'category', data: mn }, yAxis: { type: 'value' }, series: [{ name: 'Income', type: 'bar', data: inc }, { name: 'Expenses', type: 'bar', data: exp }] } : null);
  createChart('c2', tx.length ? { ...base, legend: undefined, xAxis: { type: 'category', data: mn }, yAxis: { type: 'value', minInterval: 1 }, series: [{ name: 'Transactions', type: 'line', smooth: true, areaStyle: { opacity: .08 }, data: months.map(m => tx.filter(t => t.date.startsWith(m)).length) }] } : null);
  const cat = {}; ok.filter(t => t.type !== 'Credit').forEach(t => cat[t.category] = (cat[t.category] || 0) + t.amount);
  createChart('c3', donut(Object.entries(cat).map(([name, value]) => ({ name, value }))));
  const acc = myAccounts(); createChart('c4', acc.length ? { ...base, legend: undefined, xAxis: { type: 'category', data: acc.map(a => '****' + a.number.slice(-4)) }, yAxis: { type: 'value' }, series: [{ name: 'Balance', type: 'bar', data: acc.map(a => a.balance) }] } : null);
  createChart('c5', donut(['Success', 'Failed', 'Pending'].map(name => ({ name, value: tx.filter(t => t.status === name).length })).filter(x => x.value)));
}

/* Router + pages */
const pages = {};
function route() {
  const s = session(); if (!s) return; destroyAllCharts();
  let r = location.hash.replace('#/', '') || 'dashboard'; const item = NAV.find(n => n[0] === r);
  if (!item || !item[3].includes(s.role)) { r = 'dashboard'; location.hash = '#/dashboard'; }
  const n = NAV.find(x => x[0] === r); $('#pt').textContent = n[1]; $('#bc').textContent = 'Home / ' + n[1];
  $$('.side nav a').forEach(a => a.classList.toggle('active', a.dataset.r === r));
  $('#side').classList.remove('open'); $('#scrim').classList.remove('on');
  const v = $('#view'); v.innerHTML = ''; pages[r](v); updateDot();
}
function updateDot() { const s = session(); $('#dot').hidden = !getData(K.notifications).some(n => !n.read && (s.role === 'admin' || n.scope === 'all' || n.scope === s.customerId)); }

pages.dashboard = v => {
  const a = myAccounts(), tx = myTxns(), ok = tx.filter(t => t.status === 'Success'), since = Date.now() - 30 * 864e5;
  const m = f => ok.filter(t => new Date(t.date) >= since && f(t)).reduce((x, t) => x + t.amount, 0);
  const cards = [['wallet', 'Total Balance', money(a.reduce((x, y) => x + y.balance, 0)), 'Across all accounts'], ['circle-check', 'Available Balance', money(a.filter(x => x.status === 'Active').reduce((x, y) => x + y.available, 0)), 'Active accounts only'],
    ['building-columns', 'Total Accounts', a.length, a.filter(x => x.status === 'Active').length + ' active'], ['arrow-trend-up', 'Monthly Income', money(m(t => t.type === 'Credit')), 'Last 30 days'],
    ['arrow-trend-down', 'Monthly Expenses', money(m(t => t.type !== 'Credit')), tx.length + ' transactions, ' + tx.filter(t => t.status === 'Failed').length + ' failed']];
  v.innerHTML = `<div class="cards">${cards.map(c => `<div class="card stat"><span class="si">${ic(c[0])}</span><div><small>${c[1]}</small><b>${c[2]}</b><em>${c[3]}</em></div></div>`).join('')}</div>
    <div class="charts"><div class="card"><h3>Monthly income vs expenses</h3><div class="chart" id="c1"></div></div><div class="card"><h3>Transaction overview</h3><div class="chart" id="c2"></div></div>
    <div class="card"><h3>Spending categories</h3><div class="chart" id="c3"></div></div><div class="card"><h3>Account balance distribution</h3><div class="chart" id="c4"></div></div>
    <div class="card"><h3>Transaction status</h3><div class="chart" id="c5"></div></div></div>`;
  initDashboardCharts();
};

/* Generic CRUD page driven by config */
function crud(v, c) {
  const manage = can(c.perm);
  const draw = dataTable(v, { rows: c.rows, cols: c.cols, filter: c.filter, empty: c.empty, icon: c.icon,
    toolbar: manage && c.fields ? `<button class="btn btn-primary" id="add">${ic('plus')}Add ${c.title}</button>` : '',
    actions: r => `<button class="icon-btn" data-act="view" title="View">${ic('eye')}</button>${manage && c.fields ? `<button class="icon-btn" data-act="edit" title="Edit">${ic('pen')}</button>` : ''}${manage && c.toggle ? `<button class="icon-btn" data-act="tog" title="${r.status === c.toggle[0] ? 'Suspend or deactivate' : 'Activate'}">${ic(r.status === c.toggle[0] ? 'ban' : 'circle-check')}</button>` : ''}${manage && c.del ? `<button class="icon-btn danger" data-act="del" title="Delete">${ic('trash')}</button>` : ''}`,
    onAction: (act, r) => {
      if (act === 'view') return openModal({ title: c.title + ' details', body: `<dl class="dl">${c.cols.map(k => `<dt>${k.l}</dt><dd>${k.fmt ? k.fmt(r[k.k], r) : esc(r[k.k])}</dd>`).join('')}</dl>${c.extra ? c.extra(r) : ''}`, actions: [{ label: 'Close' }], wide: true });
      if (!can(c.perm)) return toast('error', 'You are not authorised to perform this action');
      if (act === 'edit') return form(r);
      if (act === 'tog') { const to = r.status === c.toggle[0] ? c.toggle[1] : c.toggle[0]; updateData(c.key, r.id, { status: to }); audit(c.title + ' ' + to, c.title, r.id); toast('success', c.title + ' status set to ' + to); return draw(); }
      if (act === 'del') confirmDialog('Delete ' + c.title.toLowerCase(), 'This action cannot be undone.', 'Delete', () => { deleteData(c.key, r.id); audit(c.title + ' Deleted', c.title, r.id); toast('success', c.title + ' deleted'); draw(); });
    } });
  const form = rec => {
    const isNew = !rec, f = c.fields, vals = rec || c.defaults();
    const el = openModal({ title: (isNew ? 'Add ' : 'Edit ') + c.title, wide: true, body: `<form class="grid2" novalidate>${f.map(x => `<div class="fld"><label>${x.l}</label>${x.dd ? `<div data-f="${x.k}"></div>` : `<input data-f="${x.k}" type="${x.type || 'text'}" value="${esc(vals[x.k])}" ${x.ro && !isNew ? 'readonly' : ''}>`}<div class="err"></div></div>`).join('')}</form>`,
      actions: [{ label: 'Cancel' }, { label: 'Save', cls: 'btn-primary', keep: true, onClick: m => {
        const d = validateForm(m, f); if (!d) return false; const body = { ...d }; c.prep && c.prep(body, isNew);
        if (isNew) insertData(c.key, { ...body, created: new Date().toISOString() }); else updateData(c.key, rec.id, body);
        audit(c.title + (isNew ? ' Created' : ' Updated'), c.title, body.name || body.number || body.code || ''); toast('success', c.title + (isNew ? ' created' : ' updated')); closeModal(); draw(); } }] });
    f.filter(x => x.dd).forEach(x => { const d = $(`[data-f="${x.k}"]`, el); new SearchableDropdown(d, { placeholder: 'Select ' + x.l.toLowerCase(), data: typeof x.dd === 'function' ? x.dd() : x.dd, value: vals[x.k] }); });
  };
  if (manage && c.fields) $('#add', v).onclick = () => form();
}
const R = validateRequired, st = (...s) => ({ key: 'status', label: 'Status', options: opts(s) });
const stCol = { k: 'status', l: 'Status', fmt: badge };

pages.accounts = v => crud(v, { key: K.accounts, title: 'Account', perm: 'Manage Accounts', icon: 'building-columns', toggle: ['Active', 'Suspended'], del: false,
  rows: () => myAccounts().map(a => ({ ...a, customer: custName(a.customerId) })), filter: st('Active', 'Suspended', 'Closed', 'Pending'),
  cols: [{ k: 'number', l: 'Account Number' }, { k: 'customer', l: 'Customer' }, { k: 'type', l: 'Type' }, { k: 'balance', l: 'Balance', fmt: money }, { k: 'available', l: 'Available', fmt: money }, stCol, { k: 'created', l: 'Created', fmt: fdate }],
  fields: [{ k: 'customerId', l: 'Customer', dd: () => getData(K.customers).map(c => ({ value: c.id, label: c.name, sub: c.code })), rules: [R] },
    { k: 'type', l: 'Account Type', dd: opts(['Savings', 'Current', 'Salary', 'Fixed Deposit']), rules: [R] },
    { k: 'balance', l: 'Balance', rules: [(x, l) => x === '0' ? '' : validateAmount(x, l)] }, { k: 'status', l: 'Status', dd: opts(['Active', 'Suspended', 'Closed', 'Pending']), rules: [R] }],
  defaults: () => ({ status: 'Pending', balance: '0' }), prep: (b, isNew) => { b.balance = +b.balance; b.available = b.balance; if (isNew) b.number = String(500100200000 + Math.floor(Math.random() * 9e5)); } });

pages.customers = v => crud(v, { key: K.customers, title: 'Customer', perm: 'Manage Customers', icon: 'users', toggle: ['Active', 'Suspended'],
  rows: () => getData(K.customers), filter: st('Active', 'Suspended'),
  cols: [{ k: 'code', l: 'Customer ID' }, { k: 'name', l: 'Name' }, { k: 'email', l: 'Email' }, { k: 'phone', l: 'Phone' }, stCol, { k: 'created', l: 'Created', fmt: fdate }],
  fields: [{ k: 'name', l: 'Customer Name', rules: [R, minLen(2), validateName] }, { k: 'email', l: 'Email', rules: [R, validateEmail] }, { k: 'phone', l: 'Phone', rules: [R, validatePhone] }, { k: 'status', l: 'Status', dd: opts(['Active', 'Suspended']), rules: [R] }],
  defaults: () => ({ status: 'Active' }), prep: (b, n) => { if (n) b.code = 'CUST' + (1001 + getData(K.customers).length); },
  extra: r => { const ac = getData(K.accounts).filter(a => a.customerId === r.id), ids = ac.map(a => a.id);
    return `<h4>Related accounts</h4><p>${ac.map(a => a.number + ' (' + a.type + ')').join(', ') || 'None'}</p><h4>Recent transactions</h4><p>${getData(K.transactions).filter(t => ids.includes(t.accountId)).slice(0, 3).map(t => t.reference + ' ' + money(t.amount)).join(', ') || 'None'}</p><h4>Beneficiaries</h4><p>${getData(K.beneficiaries).filter(b => b.ownerId === r.id).map(b => b.name).join(', ') || 'None'}</p>`; } });

pages.beneficiaries = v => crud(v, { key: K.beneficiaries, title: 'Beneficiary', perm: 'Manage Beneficiaries', icon: 'address-book', toggle: ['Active', 'Inactive'], del: true,
  rows: () => getData(K.beneficiaries).filter(b => b.ownerId === session().customerId), filter: st('Active', 'Inactive'),
  cols: [{ k: 'name', l: 'Name' }, { k: 'nick', l: 'Nickname' }, { k: 'number', l: 'Account Number' }, { k: 'bank', l: 'Bank' }, { k: 'ifsc', l: 'IFSC' }, stCol],
  fields: [{ k: 'name', l: 'Beneficiary Name', rules: [R, minLen(2), validateName] }, { k: 'number', l: 'Account Number', rules: [R, validateAccountNumber] },
    { k: 'bank', l: 'Bank Name', dd: opts(['Demo National Bank', 'Sample Trust Bank', 'Example Savings Bank', 'Fictional Union Bank']), rules: [R] },
    { k: 'ifsc', l: 'IFSC Code', rules: [R, validateIFSC] }, { k: 'nick', l: 'Nickname', rules: [R, maxLen(20)] }, { k: 'status', l: 'Status', dd: opts(['Active', 'Inactive']), rules: [R] }],
  defaults: () => ({ status: 'Active' }), prep: b => { b.ifsc = b.ifsc.toUpperCase(); b.ownerId = session().customerId; } });

pages.employees = v => crud(v, { key: K.employees, title: 'Employee', perm: 'Manage Employees', icon: 'id-badge', toggle: ['Active', 'Inactive'],
  rows: () => getData(K.employees), filter: st('Active', 'Inactive'),
  cols: [{ k: 'code', l: 'Employee ID' }, { k: 'name', l: 'Name' }, { k: 'email', l: 'Email' }, { k: 'dept', l: 'Department' }, { k: 'role', l: 'Role' }, stCol],
  fields: [{ k: 'name', l: 'Employee Name', rules: [R, minLen(2), validateName] }, { k: 'email', l: 'Email', rules: [R, validateEmail] },
    { k: 'dept', l: 'Department', dd: opts(['Operations', 'Compliance', 'Customer Care', 'Risk']), rules: [R] }, { k: 'role', l: 'Role', dd: () => getData(K.roles).filter(r => r.id !== 'customer').map(r => ({ value: r.name, label: r.name })), rules: [R] },
    { k: 'status', l: 'Status', dd: opts(['Active', 'Inactive']), rules: [R] }],
  defaults: () => ({ status: 'Active' }), prep: (b, n) => { if (n) b.code = 'EMP' + (201 + getData(K.employees).length); } });

/* Transactions (also used for suspicious activity) */
function txnPage(v, filterFn) {
  const typeF = { key: 'type', label: 'Type', options: opts(['Credit', 'Debit', 'Transfer']) };
  dataTable(v, { rows: () => myTxns().filter(filterFn).sort((a, b) => b.date.localeCompare(a.date)), filter: typeF, icon: 'receipt', empty: 'No transactions found',
    cols: [{ k: 'reference', l: 'Reference' }, { k: 'date', l: 'Date', fmt: fdate }, { k: 'account', l: 'Account' }, { k: 'type', l: 'Type' }, { k: 'amount', l: 'Amount', fmt: money }, { k: 'description', l: 'Description' }, stCol],
    actions: () => `<button class="icon-btn" data-act="view" title="View">${ic('eye')}</button>`,
    onAction: (a, r) => openModal({ title: 'Transaction ' + r.reference, wide: true, actions: [{ label: 'Close' }], body: `<dl class="dl"><dt>Date</dt><dd>${fdate(r.date)}</dd><dt>Account</dt><dd>${r.account}</dd><dt>Customer</dt><dd>${esc(r.customer)}</dd><dt>Type</dt><dd>${r.type}</dd><dt>Amount</dt><dd>${money(r.amount)}</dd><dt>Status</dt><dd>${badge(r.status)}</dd><dt>Description</dt><dd>${esc(r.description)}</dd></dl>` }) });
}
pages.transactions = v => txnPage(v, () => true);
pages.suspicious = v => txnPage(v, t => t.status === 'Failed' || t.amount >= 75000);

/* Fund transfer workflow */
pages.transfer = v => {
  const s = session(), lim = settings().transferLimit;
  v.innerHTML = `<div class="card narrow"><h3>New transfer</h3><form novalidate class="grid2"><div class="fld"><label>From Account</label><div data-f="from"></div><div class="err"></div></div>
    <div class="fld"><label>Beneficiary</label><div data-f="ben"></div><div class="err"></div></div><div id="binfo" class="info" hidden></div>
    <div class="fld"><label>Transfer Amount</label><input data-f="amt" inputmode="decimal" placeholder="0.00"><div class="err"></div></div>
    <div class="fld"><label>Transfer Type</label><div data-f="type"></div><div class="err"></div></div>
    <div class="fld full"><label>Description</label><input data-f="desc" maxlength="80"><div class="err"></div></div>
    <div class="full"><button class="btn btn-primary" type="submit">Review transfer</button></div></form></div>`;
  const f = $('form', v), ben = () => getData(K.beneficiaries).filter(b => b.ownerId === s.customerId && b.status === 'Active');
  new SearchableDropdown($('[data-f=from]', v), { placeholder: 'Select account', data: myAccounts().filter(a => a.status === 'Active').map(a => ({ value: a.id, label: a.type + ' ' + a.number, sub: 'Available ' + money(a.available) })) });
  new SearchableDropdown($('[data-f=ben]', v), { placeholder: 'Select beneficiary', data: ben().map(b => ({ value: b.id, label: b.name, sub: b.bank })),
    onChange: i => { const b = i && ben().find(x => x.id === i.value), p = $('#binfo'); p.hidden = !b; if (b) p.innerHTML = `${esc(b.name)} - ${esc(b.number)} - ${esc(b.bank)} - ${esc(b.ifsc)}`; } });
  new SearchableDropdown($('[data-f=type]', v), { placeholder: 'Select type', data: opts(['IMPS', 'NEFT', 'RTGS']) });
  f.onsubmit = e => {
    e.preventDefault();
    const d = validateForm(f, [{ k: 'from', l: 'From account', rules: [R] }, { k: 'ben', l: 'Beneficiary', rules: [R] }, { k: 'type', l: 'Transfer type', rules: [R] },
      { k: 'amt', l: 'Amount', rules: [validateAmount, (x, l, all) => { const a = getData(K.accounts).find(y => y.id === all.from); return a && +x > a.available ? 'Insufficient balance. Available: ' + money(a.available) : ''; },
        x => +x > lim ? 'Amount exceeds the transfer limit of ' + money(lim) : ''] }, { k: 'desc', l: 'Description', rules: [maxLen(80)] }]);
    if (!d) return;
    const b = ben().find(x => x.id === d.ben);
    openModal({ title: 'Confirm transfer', body: `<dl class="dl"><dt>From</dt><dd>${esc($('[data-f=from] .sd-t', v).textContent)}</dd><dt>To</dt><dd>${esc(b.name)} (${esc(b.number)})</dd><dt>Amount</dt><dd><b>${money(+d.amt)}</b></dd><dt>Type</dt><dd>${d.type}</dd><dt>Note</dt><dd>${esc(d.desc) || '-'}</dd></dl>`,
      actions: [{ label: 'Cancel' }, { label: 'Confirm transfer', cls: 'btn-primary', onClick: () => new Promise(r => setTimeout(() => { process(d, b); r(); }, 600)) }] });
  };
  function process(d, b) {
    const a = getData(K.accounts).find(x => x.id === d.from), amt = +d.amt, ref = generateTransactionReference();
    if (!a || a.status !== 'Active' || amt > a.available || b.status !== 'Active') { notify('Transfer Failed', 'Transfer to ' + b.name + ' failed.', s.customerId); audit('Transfer Failed', 'Transfers', ref); return toast('error', 'Transfer failed. No funds were moved.'); }
    updateData(K.accounts, a.id, { balance: a.balance - amt, available: a.available - amt });
    const rx = getData(K.accounts).find(x => x.number === b.number); if (rx) updateData(K.accounts, rx.id, { balance: rx.balance + amt, available: rx.available + amt });
    insertData(K.transactions, { reference: ref, accountId: a.id, type: 'Transfer', amount: amt, description: d.desc || 'Transfer to ' + b.name, category: 'Transfers', status: 'Success', date: new Date().toISOString() });
    if (rx) insertData(K.transactions, { reference: ref + 'C', accountId: rx.id, type: 'Credit', amount: amt, description: 'Received from ' + s.name, category: 'Income', status: 'Success', date: new Date().toISOString() });
    notify('Transfer Successful', money(amt) + ' sent to ' + b.name + '. Ref ' + ref, s.customerId); audit('Transfer Completed', 'Transfers', ref, money(amt));
    toast('success', 'Transfer completed. Reference ' + ref); pages.transfer(v);
  }
};

/* Notifications */
pages.notifications = v => {
  const s = session(), icons = { 'Transfer Successful': 'circle-check', 'Transfer Failed': 'circle-xmark', 'Account Update': 'user-pen', 'Security Alert': 'shield-halved', 'System Notification': 'gear' };
  const draw = () => {
    const l = getData(K.notifications).filter(n => s.role === 'admin' || n.scope === 'all' || n.scope === s.customerId).sort((a, b) => b.date.localeCompare(a.date));
    v.innerHTML = `<div class="toolbar"><div class="grow"></div><button class="btn btn-ghost" id="mr">${ic('check-double')}Mark all as read</button></div><div class="card flush">${l.length ? l.map(n => `<div class="note-row ${n.read ? '' : 'unread'}"><span class="si">${ic(icons[n.type])}</span><div class="grow"><b>${esc(n.title)}</b><p>${esc(n.message)}</p><small>${fdate(n.date)}</small></div>
      ${n.read ? '' : `<button class="icon-btn" data-r="${n.id}" title="Mark as read">${ic('check')}</button>`}<button class="icon-btn danger" data-d="${n.id}" title="Delete">${ic('trash')}</button></div>`).join('') : `<div class="empty">${ic('bell-slash')}<h4>No notifications</h4><p>You are all caught up.</p></div>`}</div>`;
    $('#mr').onclick = () => { l.forEach(n => updateData(K.notifications, n.id, { read: true })); draw(); updateDot(); };
    $$('[data-r]', v).forEach(b => b.onclick = () => { updateData(K.notifications, b.dataset.r, { read: true }); draw(); updateDot(); });
    $$('[data-d]', v).forEach(b => b.onclick = () => { deleteData(K.notifications, b.dataset.d); toast('info', 'Notification deleted'); draw(); updateDot(); });
  }; draw();
};

pages.audit = v => dataTable(v, { rows: () => getData(K.audit_logs).slice().reverse(), icon: 'clipboard-list', empty: 'No audit logs',
  filter: { key: 'module', label: 'Module', options: opts(['Authentication', 'Accounts', 'Beneficiaries', 'Transfers', 'Customers', 'Employees', 'Roles']) },
  cols: [{ k: 'user', l: 'User' }, { k: 'action', l: 'Action' }, { k: 'module', l: 'Module' }, { k: 'entity', l: 'Entity' }, { k: 'timestamp', l: 'Timestamp', fmt: d => new Date(d).toLocaleString('en-IN') }, { k: 'details', l: 'Details' }] });

pages.roles = v => {
  const roles = getData(K.roles), ok = can('Manage Roles');
  v.innerHTML = `<div class="card flush"><div class="table-wrap"><table class="matrix"><thead><tr><th>Permission</th>${roles.map(r => `<th>${r.name}</th>`).join('')}</tr></thead><tbody>${PERMS.map(p => `<tr><td>${p}</td>${roles.map(r => `<td class="c" data-label="${r.name}"><input type="checkbox" data-r="${r.id}" data-p="${p}" ${r.perms.includes(p) ? 'checked' : ''} ${ok ? '' : 'disabled'} aria-label="${r.name}: ${p}"></td>`).join('')}</tr>`).join('')}</tbody></table></div></div>
    <div class="toolbar end"><button class="btn btn-primary" id="sv">Save permissions</button></div>`;
  $('#sv').onclick = () => { if (!can('Manage Roles')) return toast('error', 'You are not authorised to change roles');
    roles.forEach(r => r.perms = $$(`[data-r="${r.id}"]:checked`, v).map(c => c.dataset.p)); saveData(K.roles, roles); audit('Role Updated', 'Roles', 'permissions'); toast('success', 'Permissions saved'); };
};

pages.settings = v => {
  const st = settings();
  v.innerHTML = `<div class="card narrow"><h3>Platform settings</h3><form class="grid2" novalidate><div class="fld"><label>Bank Name</label><input data-f="bankName" value="${esc(st.bankName)}"><div class="err"></div></div>
    <div class="fld"><label>Daily Transfer Limit</label><input data-f="transferLimit" value="${st.transferLimit}"><div class="err"></div></div><div class="full row"><button class="btn btn-primary" type="submit">Save settings</button>
    <button class="btn btn-ghost" type="button" id="rs">Reset demo data</button></div></form></div>`;
  $('form', v).onsubmit = e => { e.preventDefault(); if (!can('Manage Settings')) return toast('error', 'Not authorised');
    const d = validateForm(e.target, [{ k: 'bankName', l: 'Bank name', rules: [R, minLen(3), maxLen(40)] }, { k: 'transferLimit', l: 'Transfer limit', rules: [validateAmount] }]); if (!d) return;
    saveData(K.settings, { bankName: d.bankName, transferLimit: +d.transferLimit }); audit('Settings Updated', 'Settings', 'platform'); toast('success', 'Settings saved'); };
  $('#rs').onclick = () => confirmDialog('Reset demo data', 'All stored data will be replaced with the demo dataset.', 'Reset', () => { Object.values(K).forEach(removeData); toast('info', 'Data reset'); setTimeout(() => { seedData(); location.hash = ''; boot(); }, 300); });
};

/* Reports with CSV export */
pages.reports = v => {
  const defs = { Transaction: () => myTxns(), Account: () => myAccounts().map(a => ({ ...a, customer: custName(a.customerId) })), Customer: () => getData(K.customers),
    Transfer: () => myTxns().filter(t => t.type === 'Transfer'), Audit: () => getData(K.audit_logs) };
  let cur = [], name = 'Transaction';
  v.innerHTML = `<div class="card"><form class="grid4" novalidate><div class="fld"><label>Report</label><div data-f="rep"></div></div><div class="fld"><label>Status</label><div data-f="st"></div></div>
    <div class="fld"><label>Date From</label><input data-f="from" type="date"><div class="err"></div></div><div class="fld"><label>Date To</label><input data-f="to" type="date"><div class="err"></div></div>
    <div class="full row"><button class="btn btn-primary" type="submit">Generate report</button><button class="btn btn-ghost" type="button" id="csv">${ic('download')}Export CSV</button><button class="btn btn-ghost" type="button" id="pr">${ic('print')}Print</button></div></form></div><div id="out"></div>`;
  const rep = new SearchableDropdown($('[data-f=rep]', v), { data: opts(Object.keys(defs)), value: 'Transaction', placeholder: 'Report' });
  const sts = new SearchableDropdown($('[data-f=st]', v), { data: opts(['Success', 'Failed', 'Pending', 'Active', 'Suspended']), placeholder: 'Any status' });
  $('form', v).onsubmit = e => { e.preventDefault();
    const d = validateForm(e.target, [{ k: 'from', l: 'Date from', rules: [validateDate] }, { k: 'to', l: 'Date to', rules: [validateDate, (x, l, a) => x && a.from && x < a.from ? 'Date to must be after date from' : ''] }]); if (!d) return;
    name = $('[data-f=rep]', v).dataset.value || 'Transaction'; const sv = $('[data-f=st]', v).dataset.value;
    cur = defs[name]().filter(r => { const dt = (r.date || r.timestamp || r.created || '').slice(0, 10); return (!d.from || !dt || dt >= d.from) && (!d.to || !dt || dt <= d.to) && (!sv || !r.status || r.status === sv); }).map(({ id, ownerId, accountId, customerId, ...r }) => r);
    const cols = cur[0] ? Object.keys(cur[0]).map(k => ({ k, l: k[0].toUpperCase() + k.slice(1) })) : [];
    dataTable($('#out', v), { rows: () => cur, cols, icon: 'file-lines', empty: 'No data for the selected filters' }); toast('success', name + ' report generated'); };
  $('#csv').onclick = () => { if (!cur.length) return toast('warning', 'Generate a report with data first');
    const ks = Object.keys(cur[0]), q = x => '"' + String(x ?? '').replace(/"/g, '""') + '"';
    const url = URL.createObjectURL(new Blob([[ks.map(q).join(','), ...cur.map(r => ks.map(k => q(r[k])).join(','))].join('\n')], { type: 'text/csv' }));
    const a = document.createElement('a'); a.href = url; a.download = name.toLowerCase() + '-report.csv'; a.click(); URL.revokeObjectURL(url); };
  $('#pr').onclick = () => print();
};

function boot() { seedData(); if (session()) { renderShell(); route(); } else renderLogin(); }
addEventListener('hashchange', route);
document.addEventListener('DOMContentLoaded', boot);

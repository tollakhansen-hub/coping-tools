/* Private owner dashboard. Never puts credentials in a URL or persistent JS storage. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const routes = [
    ['/body-wont-settle/', 'Body won’t settle'],
    ['/mind-wont-stop/', 'Mind won’t stop'],
    ['/too-much-at-once/', 'Too much at once'],
    ['/feel-low-or-shut-down/', 'Feel low or shut down'],
    ['/something-has-happened/', 'Something has happened']
  ];
  const signin = $('owner-signin'), data = $('owner-data'), logout = $('owner-logout');
  const status = $('owner-status'), token = $('owner-token'), submit = $('owner-submit');
  const display = n => Number(n || 0).toLocaleString();
  const total = (byPage, key) => routes.reduce((n, [route]) => n + Number(byPage?.[route]?.[key] || 0), 0);
  function showLogin(message) {
    data.hidden = true;
    logout.hidden = true;
    signin.hidden = false;
    status.textContent = message || 'Sign in to view the counters.';
  }
  function makeRow(label, first, second) {
    const tr = document.createElement('tr');
    for (const [value, isNumber] of [[label, false], [display(first), true], [display(second), true]]) {
      const cell = document.createElement(isNumber ? 'td' : 'th');
      if (!isNumber) cell.scope = 'row';
      if (isNumber) cell.className = 'number';
      cell.textContent = value;
      tr.appendChild(cell);
    }
    return tr;
  }
  function populateRows(element, byPage, a, b) {
    const rows = document.createDocumentFragment();
    for (const [route, label] of routes) {
      rows.appendChild(makeRow(label, byPage?.[route]?.[a] || 0, byPage?.[route]?.[b] || 0));
    }
    element.replaceChildren(rows);
  }
  function sumRecent(records, key) {
    const field = key === 'print' || key === 'pdf' ? 'action' : 'answer';
    return (Array.isArray(records) ? records : []).reduce((n, row) => n + (row[field] === key ? Number(row.count || 0) : 0), 0);
  }
  function render(payload) {
    const guides = payload.guides?.byPage || {}, feedback = payload.feedback?.byPage || {};
    $('count-print').textContent = display(total(guides, 'print'));
    $('count-pdf').textContent = display(total(guides, 'pdf'));
    $('count-yes').textContent = display(total(feedback, 'yes'));
    $('count-no').textContent = display(total(feedback, 'no'));
    populateRows($('owner-guides'), guides, 'print', 'pdf');
    populateRows($('owner-feedback'), feedback, 'yes', 'no');
    const gp = payload.guides?.last30Days || [], fp = payload.feedback?.last30Days || [];
    $('owner-recent').textContent = [
      display(sumRecent(gp, 'print')) + ' Print',
      display(sumRecent(gp, 'pdf')) + ' Save PDF',
      display(sumRecent(fp, 'yes')) + ' Yes',
      display(sumRecent(fp, 'no')) + ' No'
    ].join(' · ');
    const installs = payload.installs || {};
    $('owner-installs').textContent = [
      display(installs.pressed) + ' install-button presses',
      display(installs.accepted) + ' accepted prompts',
      display(installs.installed) + ' confirmed installs'
    ].join(' · ');
    signin.hidden = true;
    data.hidden = false;
    logout.hidden = false;
    status.textContent = '';
    $('owner-refreshed').textContent = 'Updated ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  async function load() {
    try {
      const response = await fetch('/api/owner-stats', { credentials: 'same-origin', cache: 'no-store' });
      if (response.status === 401) { showLogin(); return; }
      if (!response.ok) throw new Error('Could not retrieve counters (' + response.status + ').');
      render(await response.json());
    } catch (error) {
      status.textContent = error.message || 'Counters are temporarily unavailable.';
      if (data.hidden) showLogin(status.textContent);
    }
  }
  $('owner-form').addEventListener('submit', async event => {
    event.preventDefault();
    const value = token.value;
    if (!value) return;
    submit.disabled = true;
    status.textContent = 'Signing in…';
    try {
      const response = await fetch('/api/owner-stats/login', {
        method: 'POST', credentials: 'same-origin', cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: value })
      });
      if (response.status === 401) throw new Error('That statistics token was not accepted.');
      if (response.status === 503) throw new Error('The owner token is not configured on the website.');
      if (!response.ok) throw new Error('Sign-in unavailable (' + response.status + ').');
      token.value = '';
      await load();
    } catch (error) {
      token.value = '';
      status.textContent = error.message || 'Unable to sign in.';
      token.focus();
    } finally { submit.disabled = false; }
  });
  $('owner-refresh').addEventListener('click', async () => {
    $('owner-refresh').disabled = true;
    try { await load(); } finally { $('owner-refresh').disabled = false; }
  });
  logout.addEventListener('click', async () => {
    logout.disabled = true;
    try {
      const response = await fetch('/api/owner-stats/logout', { method: 'POST', credentials: 'same-origin', cache: 'no-store' });
      if (!response.ok) throw new Error('Sign out was unsuccessful.');
      showLogin('Signed out.');
    } catch (error) {
      status.textContent = error.message || 'Sign out was unsuccessful.';
    } finally { logout.disabled = false; }
  });
  load();
})();

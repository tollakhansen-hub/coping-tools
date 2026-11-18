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
  const careRows = [
    ['all', 'All five sections'],
    ['section-1', 'When someone’s body won’t settle'],
    ['section-2', 'When someone is caught in thoughts or worries'],
    ['section-3', 'When everything feels too much'],
    ['section-4', 'When someone feels low or withdrawn'],
    ['section-5', 'Something has happened']
  ].map(([key, label]) => ['/practical-support/#' + key, label]);
  const shareRows = [
    ['/share/#all-five-guides', 'All five coping guides'],
    ...routes.map(([key, label]) => ['/share/#' + key.slice(1, -1), label])
  ];
  const embedRows = [
    ['/share/#embed-widget', 'Five-guide widget'],
    ['/share/#embed-button', 'Compact support button'],
    ['/share/#embed-selector', 'Expandable guide selector']
  ];
  const resourceColumns = ['copy', 'print', 'pdf'];
  const period = $('owner-period');
  let payload;
  const signin = $('owner-signin'), data = $('owner-data'), logout = $('owner-logout');
  const status = $('owner-status'), token = $('owner-token'), submit = $('owner-submit');
  const display = n => Number(n || 0).toLocaleString();
  const total = (counts, rows, action) => rows.reduce(
    (sum, [key]) => sum + Number(counts?.[key]?.[action] || 0), 0
  );
  function showLogin(message) {
    payload = null;
    data.hidden = true;
    logout.hidden = true;
    signin.hidden = false;
    status.textContent = message || 'Sign in to view the counters.';
  }
  function populateRows(element, rows, counts, actions) {
    const fragment = document.createDocumentFragment();
    for (const [key, label] of rows) {
      const tr = document.createElement('tr');
      const heading = document.createElement('th');
      heading.scope = 'row';
      heading.textContent = label;
      tr.appendChild(heading);
      for (const action of actions) {
        const cell = document.createElement('td');
        cell.className = 'number';
        cell.textContent = display(counts?.[key]?.[action]);
        tr.appendChild(cell);
      }
      fragment.appendChild(tr);
    }
    element.replaceChildren(fragment);
  }
  function render() {
    const allTime = period.value === 'all';
    const actions = allTime ? payload.actions.byResource : payload.actions.last180Days;
    const feedback = allTime ? payload.feedback.byPage : payload.feedback.last180Days;
    for (const action of resourceColumns) {
      $('count-' + action).textContent = display(total(actions, [...routes, ...careRows], action));
    }
    $('count-yes').textContent = display(total(feedback, routes, 'yes'));
    $('count-no').textContent = display(total(feedback, routes, 'no'));
    populateRows($('owner-guides'), routes, actions, resourceColumns);
    populateRows($('owner-care'), careRows, actions, resourceColumns);
    populateRows($('owner-share'), shareRows, actions, ['copyLink', 'qrPng', 'qrSvg']);
    populateRows($('owner-embed'), embedRows, actions, ['copyEmbed']);
    populateRows($('owner-feedback'), routes, feedback, ['yes', 'no']);

    const { resources, installs: installStart } = payload.coverage;
    $('owner-resource-coverage').textContent = resources
      ? 'First recorded activity for the new counters: ' + resources + ' (UTC).'
      : 'The new Copy, Practical Support and Share counters are awaiting their first recorded activity.';
    const installs = allTime ? payload.installs : payload.installsLast180Days;
    $('owner-installs').textContent = [
      display(installs.pressed) + ' install prompt requests',
      display(installs.accepted) + ' accepted prompts',
      display(installs.installed) + ' browser-confirmed installs',
      display(Number(installs.appleFirstOpen || 0) + Number(installs.firstOpen || 0)) + ' first opens as an app'
    ].join(' · ');
    $('owner-install-coverage').textContent = installStart
      ? 'Dated install counts begin on ' + installStart + ' (UTC). Earlier counts are included in All time.'
      : 'The 180-day install view is awaiting its first dated event. Existing install counts appear in All time.';
    signin.hidden = true;
    data.hidden = false;
    logout.hidden = false;
    status.textContent = '';
  }
  period.addEventListener('change', () => { if (payload) render(); });
  async function load() {
    try {
      const response = await fetch('/api/owner-stats', { credentials: 'same-origin', cache: 'no-store' });
      if (response.status === 401) { showLogin(); return; }
      if (!response.ok) throw new Error('Could not retrieve counters (' + response.status + ').');
      payload = await response.json();
      render();
      $('owner-refreshed').textContent = 'Updated ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
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

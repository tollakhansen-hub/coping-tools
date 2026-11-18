'use strict';
(() => {
  const status = document.getElementById('share-feedback');
  const track = (target, action) => window.recordResourceAction?.('/share/#' + target, action);

  document.querySelectorAll('.share-row-item[data-stats-resource]').forEach(row => {
    const { statsResource } = row.dataset;
    const button = row.querySelector('[data-copy-url]');
    button.addEventListener('click', async () => {
      const url = button.dataset.copyUrl;
      try {
        if (navigator.clipboard && window.isSecureContext) {
          await navigator.clipboard.writeText(url);
        } else {
          const field = document.createElement('textarea');
          field.value = url;
          field.setAttribute('readonly', '');
          field.style.position = 'fixed';
          field.style.opacity = '0';
          document.body.appendChild(field);
          try {
            field.select();
            if (!document.execCommand('copy')) throw new Error('Copy unavailable');
          } finally {
            field.remove();
          }
        }
        status.textContent = 'Link copied: ' + url;
        track(statsResource, 'copyLink');
      } catch {
        status.textContent = 'Unable to copy automatically. Select the link shown in the list instead.';
      }
    });
    for (const [selector, action] of [['a[download][href$=".png"]', 'qrPng'], ['a[download][href$=".svg"]', 'qrSvg']]) {
      const link = row.querySelector(selector);
      link?.addEventListener('click', () => track(statsResource, action));
      link?.addEventListener('auxclick', event => {
        if (event.button === 1) track(statsResource, action);
      });
    }
  });

  const panels = document.querySelectorAll('.share-qr-detail');
  const qrButtons = document.querySelectorAll('.share-qr-button');
  qrButtons.forEach(button => {
    button.addEventListener('click', () => {
      const panel = document.getElementById(button.getAttribute('aria-controls'));
      const willOpen = panel.hidden;
      panels.forEach(p => { p.hidden = true; });
      qrButtons.forEach(b => b.setAttribute('aria-expanded', 'false'));
      panel.hidden = !willOpen;
      button.setAttribute('aria-expanded', String(willOpen));
    });
  });

  async function copyEmbed(fieldId, statusId) {
    const field = document.getElementById(fieldId);
    const status = document.getElementById(statusId);
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(field.value);
      } else {
        field.focus();
        field.select();
        if (!document.execCommand('copy')) throw new Error('Copy unavailable');
      }
      status.textContent = 'HTML copied. Paste it into an HTML block on your website.';
      track(fieldId.replace(/-code$/, ''), 'copyEmbed');
    } catch {
      field.closest('details').open = true;
      field.focus();
      field.select();
      status.textContent = 'Automatic copying was unavailable. The HTML code is now shown and selected. On iPhone or iPad, touch and hold the selected text and choose Copy. On other devices, use your usual copy command.';
    }
  }

  document.getElementById('embed-widget-copy').addEventListener('click', () => copyEmbed('embed-widget-code', 'embed-widget-status'));
  document.querySelectorAll('.embed-copy').forEach(button => {
    button.addEventListener('click', () => copyEmbed(button.dataset.embedField, button.dataset.embedStatus));
  });
})();

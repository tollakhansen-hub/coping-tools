'use strict';
(() => {
  const status = document.getElementById('share-feedback');

  document.querySelectorAll('.share-row-item').forEach(row => {
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
        status.textContent = 'Enlace copiado: ' + url;
      } catch {
        status.textContent = 'No se pudo copiar el enlace automáticamente. Puedes seleccionar el que aparece en la lista.';
      }
    });
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
      status.textContent = 'Código HTML copiado. Pégalo en un bloque HTML de tu web.';
    } catch {
      field.closest('details').open = true;
      field.focus();
      field.select();
      status.textContent = 'No se pudo copiar automáticamente. El código HTML está visible y seleccionado. En iPhone o iPad, mantén pulsado el texto y elige Copiar. En otros dispositivos, usa el comando de copia habitual.';
    }
  }

  document.getElementById('embed-widget-copy').addEventListener('click', () => copyEmbed('embed-widget-code', 'embed-widget-status'));
  document.querySelectorAll('.embed-copy').forEach(button => {
    button.addEventListener('click', () => copyEmbed(button.dataset.embedField, button.dataset.embedStatus));
  });
})();

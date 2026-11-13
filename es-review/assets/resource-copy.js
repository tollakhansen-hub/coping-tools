/* Copy the public resource text directly to the visitor's clipboard. */
window.addResourceCopy = (row, { buttonClass, description, getText }) => {
  const isSpanish = document.documentElement.lang === 'es';
  const copyLabel = isSpanish ? 'Copiar' : 'Copy';
  const copiedLabel = isSpanish ? 'Copiado' : 'Copied';
  const copiedStatus = isSpanish ? 'Copiado en el portapapeles.' : 'Copied to clipboard.';
  const copyFailure = isSpanish
    ? 'No se ha podido copiar. Puedes seleccionar y copiar el texto de esta página.'
    : 'Could not copy. You can select and copy the text on this page.';
  const descriptions = {
    'Copy this guide': 'Copiar esta guía',
    'Copy all five sections': 'Copiar las cinco secciones',
    'Copy this section': 'Copiar esta sección'
  };
  if (isSpanish && descriptions[description]) description = descriptions[description];
  const copyIcon = 'M8 8h12v12H8zM16 4H4v12';
  const button = document.createElement('button');
  button.type = 'button';
  button.className = buttonClass;
  button.setAttribute('aria-label', description);
  button.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path/></svg><span>' + copyLabel + '</span>';

  const label = button.querySelector('span');
  const icon = button.querySelector('path');
  icon.setAttribute('d', copyIcon);
  const status = document.createElement('span');
  status.className = 'copy-status feedback-sr-only';
  status.setAttribute('role', 'status');
  let reset;
  let copying = false;

  button.addEventListener('click', async () => {
    if (copying) return;
    copying = true;
    clearTimeout(reset);
    status.classList.add('feedback-sr-only');
    status.textContent = '';
    try {
      await navigator.clipboard.writeText(getText());
      label.textContent = copiedLabel;
      icon.setAttribute('d', 'm5 12 4 4L19 6');
      status.textContent = copiedStatus;
      reset = setTimeout(() => {
        label.textContent = copyLabel;
        icon.setAttribute('d', copyIcon);
        status.textContent = '';
      }, 2200);
    } catch {
      label.textContent = copyLabel;
      icon.setAttribute('d', copyIcon);
      status.classList.remove('feedback-sr-only');
      status.textContent = copyFailure;
    } finally {
      copying = false;
    }
  });
  row.prepend(button);
  row.append(status);
};

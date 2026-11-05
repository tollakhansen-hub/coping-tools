/* Print the complete resource or one selected professional support section. */
(() => {
  const allButton = document.getElementById('care-print');
  const resourceSections = Array.from(document.querySelectorAll('details.care-disclosure:not(.evidence)'));
  const allDetails = Array.from(document.querySelectorAll('details'));
  let previousOpen = null;
  let chosenSection = null;

  function restore() {
    if (previousOpen) {
      allDetails.forEach((section, index) => { section.open = previousOpen[index]; });
    }
    previousOpen = null;
    chosenSection = null;
    document.body.removeAttribute('data-print-mode');
    resourceSections.forEach(section => section.removeAttribute('data-print-selected'));
  }

  function preparePrint() {
    if (!previousOpen) previousOpen = allDetails.map(section => section.open);
    const single = chosenSection !== null;
    document.body.setAttribute('data-print-mode', single ? 'single' : 'all');
    resourceSections.forEach(section => {
      section.open = !single || section === chosenSection;
      if (single && section === chosenSection) section.setAttribute('data-print-selected', '');
      else section.removeAttribute('data-print-selected');
    });
    const evidence = document.querySelector('details.care-disclosure.evidence');
    if (evidence) evidence.open = false;
  }

  function recordAction(section, action) {
    const index = section ? resourceSections.indexOf(section) + 1 : 0;
    if (section && index < 1) return;
    const page = '/practical-support/' + (index ? 'section-' + index + '/' : 'all/');
    // Anonymous counts only; never block the user's print or download.
    fetch('/api/guide-event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      keepalive: true,
      body: JSON.stringify({ page, action })
    }).catch(() => {});
  }

  function requestPrint(section) {
    recordAction(section, 'print');
    restore();
    chosenSection = section;
    preparePrint();
    window.print();
  }

  if (allButton) allButton.addEventListener('click', () => requestPrint(null));
  resourceSections.forEach(section => {
    const button = section.querySelector('.care-print-section');
    if (button) button.addEventListener('click', () => requestPrint(section));
  });
  document.querySelectorAll('a.care-save-pdf').forEach(link => {
    link.addEventListener('click', () => {
      const section = link.closest('details.care-disclosure:not(.evidence)');
      recordAction(section || null, 'pdf');
    });
  });
  window.addEventListener('beforeprint', preparePrint);
  window.addEventListener('afterprint', restore);
})();

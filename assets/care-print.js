/* Print the complete resource or one selected professional support section. */
(() => {
  const allButton = document.getElementById('care-print');
  const resourceSections = Array.from(document.querySelectorAll('details.care-disclosure:not(.evidence)'));
  const formatSection = section => [
    section.querySelector('summary').textContent.trim(),
    ...[...section.querySelectorAll('.care-part')].map(part =>
      [...part.querySelectorAll('h3, p, li')].map(block =>
        (block.tagName === 'LI' ? '• ' : '') + block.textContent.replace(/\s+/g, ' ').trim()
      ).join('\n')
    )
  ].join('\n\n');

  const source = 'https://coping.tools/practical-support/';
  if (allButton) {
    window.addResourceCopy?.(allButton.parentElement, {
      buttonClass: 'copy-action',
      description: 'Copy all five sections',
      getText: () => [document.querySelector('h1').textContent.trim(), ...resourceSections.map(formatSection), source].join('\n\n')
    });
  }
  resourceSections.forEach(section => {
    const row = section.querySelector('.section-print-action');
    if (!row) return;
    window.addResourceCopy?.(row, {
      buttonClass: 'copy-action',
      description: 'Copy this section',
      getText: () => [formatSection(section), source].join('\n\n')
    });
  });

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

  function requestPrint(section) {
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
  window.addEventListener('beforeprint', preparePrint);
  window.addEventListener('afterprint', restore);
})();

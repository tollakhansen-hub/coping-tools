(() => {
  const gateway = document.querySelector('[data-spanish-gateway]');
  if (gateway) {
    const preferredLanguage = navigator.languages?.[0] || navigator.language || '';
    gateway.hidden = preferredLanguage.toLowerCase().split('-')[0] !== 'es';
  }

  const key = 'coping-tools-footer-language-switch';
  const url = new URL(location.href);
  const setting = url.searchParams.get('language-switch');
  const explicitChoice = setting === '1' || setting === '0';
  let enabled = setting === '1';

  try {
    if (explicitChoice) {
      if (enabled) localStorage.setItem(key, '1');
      else localStorage.removeItem(key);
    } else {
      enabled = localStorage.getItem(key) === '1';
    }
  } catch {
    // With storage disabled, an explicit opt-in applies to this page only.
  }

  if (explicitChoice) {
    url.searchParams.delete('language-switch');
    history.replaceState(null, '', url);
  }
  if (!enabled) return;

  const footer = document.querySelector('footer .footer-links');
  const current = document.documentElement.lang;
  const other = current === 'es' ? 'en' : 'es';
  const alternate = document.querySelector(`link[rel="alternate"][hreflang="${other}"]`);
  if (!footer || !alternate) return;

  const switcher = document.createElement('span');
  switcher.dataset.footerLanguageSwitch = '';
  switcher.setAttribute('role', 'group');
  switcher.setAttribute('aria-label', current === 'es' ? 'Idioma' : 'Page language');

  for (const [language, label] of [['en', 'English'], ['es', 'Español']]) {
    const option = document.createElement(language === current ? 'abbr' : 'a');
    option.textContent = language.toUpperCase();
    option.lang = language;
    if (language === current) {
      option.title = label;
      option.setAttribute('aria-current', 'page');
    } else {
      option.href = new URL(alternate.href).pathname;
      option.hreflang = language;
      option.setAttribute('aria-label', label);
    }
    if (language === 'es') switcher.append(' / ');
    switcher.append(option);
  }
  footer.append(switcher);
})();

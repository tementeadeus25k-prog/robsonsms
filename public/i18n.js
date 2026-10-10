/* ROBSONSMS — idioma do site (PT padrão, EN opcional).
   Leve de propósito: para quem está em português não baixa nada além disto.
   Em inglês, carrega /i18n-en.js (dicionário + tradutor) antes do resto da página. */
(function () {
  var CHAVE = 'robsonsms-lang';
  var ls = null;
  try { ls = window.localStorage; } catch (e) {}
  try {
    var q = new URLSearchParams(location.search).get('lang');
    if (ls && (q === 'en' || q === 'pt')) ls.setItem(CHAVE, q);
  } catch (e) {}
  var lang = 'pt';
  try { lang = ls && ls.getItem(CHAVE) === 'en' ? 'en' : 'pt'; } catch (e) {}
  document.documentElement.lang = lang === 'en' ? 'en' : 'pt-BR';
  window.ROBSONSMS_LANG = lang;

  // trocou o idioma em qualquer lugar (inclusive no botão PT/EN do site) -> recarrega já traduzido
  try {
    var orig = Storage.prototype.setItem;
    Storage.prototype.setItem = function (k, v) {
      var antes = null;
      try { antes = this.getItem(k); } catch (e) {}
      orig.apply(this, arguments);
      if (k === CHAVE && this === ls && antes !== v && (v === 'en' || v === 'pt') && v !== lang) {
        setTimeout(function () { location.reload(); }, 20);
      }
    };
  } catch (e) {}

  window.robsonsmsTrocarIdioma = function (novo) {
    try { ls && ls.setItem(CHAVE, novo); } catch (e) { location.search = '?lang=' + novo; }
  };

  // seletor de idioma em todas as páginas (a home já tem o seu próprio no topo)
  function seletor() {
    if (document.getElementById('rs-lang')) return;
    var b = document.createElement('div');
    b.id = 'rs-lang';
    b.setAttribute('role', 'group');
    b.setAttribute('aria-label', lang === 'en' ? 'Language' : 'Idioma');
    b.innerHTML = '<button type="button" data-l="pt" lang="pt-BR" aria-pressed="' + (lang === 'pt') + '">PT</button>' +
                  '<button type="button" data-l="en" lang="en" aria-pressed="' + (lang === 'en') + '">EN</button>';
    b.addEventListener('click', function (ev) {
      var l = ev.target && ev.target.getAttribute('data-l');
      if (l && l !== lang) window.robsonsmsTrocarIdioma(l);
    });
    var css = document.createElement('style');
    css.textContent = '#rs-lang{position:fixed;left:14px;bottom:14px;z-index:60;display:flex;gap:2px;padding:3px;border-radius:999px;' +
      'background:rgba(255,255,255,.92);border:1px solid rgba(15,23,42,.14);box-shadow:0 6px 20px -10px rgba(15,23,42,.35);font:600 12px/1 system-ui,sans-serif}' +
      '#rs-lang button{min-width:44px;min-height:32px;border:0;border-radius:999px;background:transparent;color:#334155;cursor:pointer;font:inherit;letter-spacing:.04em}' +
      '#rs-lang button[aria-pressed=true]{background:#38bdf8;color:#062b40}' +
      '#rs-lang button:focus-visible{outline:2px solid #0284c7;outline-offset:2px}' +
      'body:has(.side-item) #rs-lang,body:has(.hx-nav) #rs-lang{display:none}' +
      '[data-theme=dark] #rs-lang{background:rgba(12,20,28,.92);border-color:rgba(255,255,255,.14)}[data-theme=dark] #rs-lang button{color:#cbd5e1}' +
      '[data-theme=dark] #rs-lang button[aria-pressed=true]{color:#062b40}' +
      '@media (prefers-color-scheme:dark){html:not([data-theme]) body:not(:has(#root)) #rs-lang{background:rgba(12,20,28,.92);border-color:rgba(255,255,255,.14)}' +
      'html:not([data-theme]) body:not(:has(#root)) #rs-lang button{color:#cbd5e1}html:not([data-theme]) body:not(:has(#root)) #rs-lang button[aria-pressed=true]{color:#062b40}}';
    document.head.appendChild(css);
    document.body.appendChild(b);
  }
  function talvezSeletor() {
    // a página inicial tem o botão PT/EN no topo; nas demais aparece o seletor flutuante
    if (location.pathname === '/' || location.pathname === '') {
      var x = document.getElementById('rs-lang');
      if (x) x.remove();
      return;
    }
    seletor();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', talvezSeletor);
  else talvezSeletor();
  // navegação interna do app (sem recarregar a página)
  ['pushState', 'replaceState'].forEach(function (m) {
    var o = history[m];
    history[m] = function () { var r = o.apply(this, arguments); setTimeout(talvezSeletor, 0); return r; };
  });
  window.addEventListener('popstate', function () { setTimeout(talvezSeletor, 0); });

  if (lang === 'en') document.write('<script src="/i18n-en.js"><\/script>');
})();

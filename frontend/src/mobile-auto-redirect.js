const mobileRedirect = { done: false };

function isMobileDevice() {
  const ua = navigator.userAgent || '';
  const byAgent = /Android|iPhone|iPod|Mobile|Windows Phone/i.test(ua);
  const byScreen = window.matchMedia('(max-width: 820px)').matches;
  const touch = navigator.maxTouchPoints > 0;
  return byAgent || (byScreen && touch);
}

function isExcludedPath(pathname) {
  return pathname.startsWith('/pedir')
    || pathname.startsWith('/pedido-mobile')
    || pathname.startsWith('/mobile')
    || pathname.startsWith('/admin')
    || pathname.startsWith('/cozinha')
    || pathname.startsWith('/entregas')
    || pathname.startsWith('/acompanhar')
    || pathname.startsWith('/api')
    || pathname.includes('.');
}

function shouldSkipByQuery() {
  const params = new URLSearchParams(window.location.search);
  return params.get('desktop') === '1' || params.get('normal') === '1';
}

function redirectMobileCustomer() {
  if (mobileRedirect.done) return;
  mobileRedirect.done = true;
  const path = window.location.pathname || '/';
  if (!isMobileDevice()) return;
  if (isExcludedPath(path)) return;
  if (shouldSkipByQuery()) return;
  const next = encodeURIComponent(`${path}${window.location.search || ''}`);
  window.location.replace(`/pedir?origem=${next}`);
}

redirectMobileCustomer();

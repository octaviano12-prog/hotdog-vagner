function isMobileOrderRoute() {
  return ['/pedir', '/pedido-mobile', '/mobile'].some((path) => window.location.pathname === path || window.location.pathname.startsWith(`${path}/`));
}

function normalizeAfterLogin() {
  if (!isMobileOrderRoute()) return;
  const url = new URL(window.location.href);
  url.pathname = '/pedir';
  url.searchParams.set('session', 'ok');
  setTimeout(() => window.location.replace(url.toString()), 80);
}

window.addEventListener('hotdog-customer-session', normalizeAfterLogin);

function isMobileDevice() {
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || (window.innerWidth <= 760 && navigator.maxTouchPoints > 0);
}

function isMobileOrderRoute() {
  return ['/pedir', '/pedido-mobile', '/mobile'].some((path) => window.location.pathname === path || window.location.pathname.startsWith(`${path}/`));
}

function isBlockedRoute() {
  return window.location.pathname.includes('admin') || window.location.pathname.includes('cozinha') || window.location.pathname.includes('acompanhar') || window.location.pathname.includes('pedido-status') || window.location.pathname.startsWith('/api');
}

function openCustomerModalSafely(tab = 'login') {
  if (window.hotdogOpenAccountModal) {
    window.hotdogOpenAccountModal(tab);
    return;
  }

  window.dispatchEvent(new CustomEvent('hotdog-open-account', { detail: { tab } }));

  const float = document.querySelector('.customer-account-float');
  if (float) {
    float.click();
    return;
  }

  let attempts = 0;
  const timer = setInterval(() => {
    attempts += 1;
    if (window.hotdogOpenAccountModal) {
      clearInterval(timer);
      window.hotdogOpenAccountModal(tab);
      return;
    }
    const nextFloat = document.querySelector('.customer-account-float');
    if (nextFloat) {
      clearInterval(timer);
      nextFloat.click();
    }
    if (attempts > 12) clearInterval(timer);
  }, 120);
}

function routeAccountClick(event) {
  const target = event.target.closest?.('[data-account],.customer-account-float');
  if (!target || !isMobileDevice() || isBlockedRoute()) return;

  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();

  if (!isMobileOrderRoute()) {
    window.location.href = '/pedir?login=1';
    return;
  }

  openCustomerModalSafely('login');
}

function autoOpenLoginOnMobileOrder() {
  if (!isMobileOrderRoute()) return;
  const params = new URLSearchParams(window.location.search);
  if (!params.has('login')) return;
  setTimeout(() => openCustomerModalSafely('login'), 700);
  const clean = new URL(window.location.href);
  clean.searchParams.delete('login');
  window.history.replaceState({}, '', clean);
}

document.addEventListener('click', routeAccountClick, true);
setTimeout(autoOpenLoginOnMobileOrder, 600);

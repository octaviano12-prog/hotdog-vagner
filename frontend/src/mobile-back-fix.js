function isMobileOrderRoute() {
  return ['/pedir', '/pedido-mobile', '/mobile'].some((path) => window.location.pathname === path || window.location.pathname.startsWith(`${path}/`));
}

function goToMenuTop() {
  const target = document.querySelector('.mobile-category-tabs') || document.querySelector('.mobile-product-list') || document.querySelector('.mobile-order-app');
  if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  else window.scrollTo({ top: 0, behavior: 'smooth' });
}

function installMobileBackFix() {
  if (!isMobileOrderRoute() || window.__hotdogMobileBackFix) return;
  window.__hotdogMobileBackFix = true;
  document.addEventListener('click', (event) => {
    const button = event.target.closest?.('[data-back]');
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    goToMenuTop();
  }, true);
}

installMobileBackFix();

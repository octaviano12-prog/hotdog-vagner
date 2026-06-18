const accountOrdersTop = { booted: false };

function isMobileOrderRoute() {
  return ['/pedir', '/pedido-mobile', '/mobile'].some((path) => window.location.pathname === path || window.location.pathname.startsWith(`${path}/`));
}

function customerProfile() {
  try {
    return JSON.parse(localStorage.getItem('hotdog_customer_profile') || 'null');
  } catch {
    return null;
  }
}

function customerToken() {
  return localStorage.getItem('hotdog_customer_token') || '';
}

function isLogged() {
  return Boolean(customerToken() && customerProfile());
}

function openOrdersTab() {
  document.querySelector('.customer-account-float')?.click();
  setTimeout(() => {
    document.querySelector('.customer-account-modal [data-tab="orders"]')?.click();
  }, 120);
}

function enhanceHeaderAccount() {
  const button = document.querySelector('.mobile-order-header [data-account]');
  if (!button) return;
  const logged = isLogged();
  button.classList.toggle('mobile-account-orders-button', logged);
  if (logged) {
    button.textContent = 'Meus pedidos';
    button.setAttribute('aria-label', 'Abrir meus pedidos');
  } else {
    button.textContent = 'Entrar';
    button.setAttribute('aria-label', 'Entrar ou cadastrar');
  }
}

function installClickGuard() {
  if (window.__hotdogMobileOrdersClick) return;
  window.__hotdogMobileOrdersClick = true;
  document.addEventListener('click', (event) => {
    const button = event.target.closest?.('.mobile-order-header [data-account]');
    if (!button || !isMobileOrderRoute() || !isLogged()) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    openOrdersTab();
  }, true);
}

function bootAccountOrdersTop() {
  if (accountOrdersTop.booted || !isMobileOrderRoute()) return;
  accountOrdersTop.booted = true;
  installClickGuard();
  setInterval(enhanceHeaderAccount, 500);
}

bootAccountOrdersTop();

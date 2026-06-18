const topLogout = { booted: false };

function isMobileOrderRoute() {
  return ['/pedir', '/pedido-mobile', '/mobile'].some((path) => window.location.pathname === path || window.location.pathname.startsWith(`${path}/`));
}

function customerToken() {
  return localStorage.getItem('hotdog_customer_token') || '';
}

function customerProfile() {
  try {
    return JSON.parse(localStorage.getItem('hotdog_customer_profile') || 'null');
  } catch {
    return null;
  }
}

function isLogged() {
  return Boolean(customerToken() && customerProfile());
}

function logoutCustomer() {
  localStorage.removeItem('hotdog_customer_token');
  localStorage.removeItem('hotdog_customer_profile');
  document.body.classList.remove('account-modal-open');
  window.location.replace('/pedir?logout=1');
}

function ensureLogoutButton() {
  if (!isMobileOrderRoute()) return;
  const header = document.querySelector('.mobile-order-header');
  if (!header) return;

  const existing = header.querySelector('[data-mobile-logout]');
  if (!isLogged()) {
    existing?.remove();
    header.classList.remove('has-mobile-logout');
    return;
  }

  header.classList.add('has-mobile-logout');
  if (existing) return;

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'mobile-logout-top';
  button.dataset.mobileLogout = '1';
  button.textContent = 'Sair';
  button.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    logoutCustomer();
  });
  header.appendChild(button);
}

function bootTopLogout() {
  if (topLogout.booted || !isMobileOrderRoute()) return;
  topLogout.booted = true;
  setInterval(ensureLogoutButton, 450);
}

bootTopLogout();

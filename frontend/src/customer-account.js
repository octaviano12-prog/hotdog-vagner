const accountState = {
  booted: false,
  token: localStorage.getItem('hotdog_customer_token') || '',
  customer: JSON.parse(localStorage.getItem('hotdog_customer_profile') || 'null'),
  orders: []
};

function isAdminPage() {
  return window.location.pathname.includes('admin');
}

function isTrackingPage() {
  return window.location.pathname.includes('acompanhar') || window.location.pathname.includes('pedido-status');
}

function isMobileOrderPage() {
  return ['/pedir', '/pedido-mobile', '/mobile'].some((path) => window.location.pathname === path || window.location.pathname.startsWith(`${path}/`));
}

function syncSessionFromStorage() {
  let storedCustomer = null;
  try {
    storedCustomer = JSON.parse(localStorage.getItem('hotdog_customer_profile') || 'null');
  } catch {
    storedCustomer = null;
  }
  accountState.token = localStorage.getItem('hotdog_customer_token') || '';
  accountState.customer = accountState.token && storedCustomer ? storedCustomer : null;
  if (!accountState.customer) accountState.orders = [];
}

function money(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0));
}

function digits(value = '') {
  return String(value || '').replace(/\D/g, '');
}

function saveSession(token, customer) {
  accountState.token = token;
  accountState.customer = customer;
  localStorage.setItem('hotdog_customer_token', token);
  localStorage.setItem('hotdog_customer_profile', JSON.stringify(customer));
}

function logout() {
  accountState.token = '';
  accountState.customer = null;
  accountState.orders = [];
  localStorage.removeItem('hotdog_customer_token');
  localStorage.removeItem('hotdog_customer_profile');
  renderAccountModal('login');
  updateFloatButton();
  window.dispatchEvent(new Event('hotdog-account-updated'));
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(accountState.token ? { Authorization: `Bearer ${accountState.token}` } : {}),
      ...(options.headers || {})
    }
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.message || 'Erro no cadastro do cliente.');
  return data;
}

function setInputValue(input, value) {
  if (!input || value === undefined || value === null) return;
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

function fillCheckout() {
  syncSessionFromStorage();
  const customer = accountState.customer;
  if (!customer || isAdminPage() || isTrackingPage()) return;

  const map = [
    ['Nome do cliente', customer.name],
    ['WhatsApp', customer.phone],
    ['Endereco de entrega', customer.address],
    ['Bairro', customer.neighborhood],
    ['Ponto de referencia', customer.reference]
  ];

  map.forEach(([placeholder, value]) => {
    const input = [...document.querySelectorAll('input')].find((field) => field.placeholder === placeholder);
    if (input && value && !input.value) setInputValue(input, value);
  });
}

function updateFloatButton() {
  syncSessionFromStorage();
  const button = document.querySelector('.customer-account-float strong');
  if (button) button.textContent = accountState.customer ? 'Minha conta' : 'Entrar / cadastrar';
}

function ensureFloatButton() {
  if (isAdminPage() || isTrackingPage() || isMobileOrderPage() || document.querySelector('.customer-account-float')) return;
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'customer-account-float';
  button.innerHTML = '<span>👤</span><strong>Entrar / cadastrar</strong>';
  button.addEventListener('click', () => openAccountModal());
  document.body.appendChild(button);
  updateFloatButton();
}

function openAccountModal(tab) {
  syncSessionFromStorage();
  const nextTab = tab || (accountState.customer ? 'profile' : 'login');
  ensureModal();
  renderAccountModal(nextTab);
  document.body.classList.add('account-modal-open');
}

window.hotdogOpenAccountModal = openAccountModal;
window.addEventListener('hotdog-open-account', (event) => {
  syncSessionFromStorage();
  openAccountModal(event.detail?.tab || (accountState.customer ? 'profile' : 'login'));
});
window.addEventListener('hotdog-customer-logout', () => {
  accountState.token = '';
  accountState.customer = null;
  accountState.orders = [];
  closeAccountModal();
  updateFloatButton();
});

function closeAccountModal() {
  document.body.classList.remove('account-modal-open');
}

function closeMobileAccountAfterAuth() {
  if (!isMobileOrderPage()) return false;
  closeAccountModal();
  window.dispatchEvent(new Event('hotdog-customer-session'));
  setTimeout(() => document.querySelector('.mobile-product-list')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 120);
  return true;
}

function ensureModal() {
  if (document.querySelector('.customer-account-overlay')) return;
  const overlay = document.createElement('div');
  overlay.className = 'customer-account-overlay';
  overlay.innerHTML = '<section class="customer-account-modal account-polished"></section>';
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) closeAccountModal();
  });
  document.body.appendChild(overlay);
}

function renderAccountModal(tab = 'login', message = '') {
  syncSessionFromStorage();
  ensureModal();
  const modal = document.querySelector('.customer-account-modal');
  const logged = Boolean(accountState.customer);

  modal.innerHTML = `
    <button class="account-close" type="button" aria-label="Fechar">×</button>
    <div class="account-head">
      <span>Conta do cliente</span>
      <h2>${logged ? `Ola, ${accountState.customer.name}` : 'Entre ou cadastre seu delivery'}</h2>
      <p>${logged ? 'Seus dados ficam salvos para pedir mais rapido.' : 'Salve nome, WhatsApp e endereco para nao preencher tudo de novo.'}</p>
    </div>
    <div class="account-tabs">
      ${logged ? '<button data-tab="profile">Meus dados</button><button data-tab="orders">Meus pedidos</button><button data-tab="loyalty" data-loyalty-tab="true">Fidelidade</button>' : '<button data-tab="login">Entrar</button><button data-tab="register">Cadastrar</button>'}
    </div>
    <div class="account-body"></div>
    <p class="account-message">${message}</p>
  `;

  modal.querySelector('.account-close').addEventListener('click', closeAccountModal);
  modal.querySelectorAll('[data-tab]').forEach((button) => button.addEventListener('click', () => renderAccountModal(button.dataset.tab)));

  if (logged && tab === 'orders') renderOrdersTab();
  else if (logged && tab === 'loyalty') renderLoyaltyTab();
  else if (logged) renderProfileTab();
  else if (tab === 'register') renderRegisterTab();
  else renderLoginTab();
}

function renderLoyaltyTab() {
  const body = document.querySelector('.account-body');
  if (body) body.innerHTML = '<p class="account-loading">Carregando fidelidade...</p>';
  if (window.hotdogRenderLoyaltyPanel) window.hotdogRenderLoyaltyPanel();
  else window.dispatchEvent(new Event('hotdog-render-loyalty'));
}

function renderLoginTab() {
  const body = document.querySelector('.account-body');
  body.innerHTML = `
    <form class="account-form" data-login-form>
      <label>WhatsApp<input name="phone" placeholder="Ex.: 18991959898" required /></label>
      <label>Senha<input name="password" type="password" placeholder="Sua senha" required /></label>
      <button>Entrar</button>
    </form>
  `;
  body.querySelector('[data-login-form]').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      const data = await api('/api/customer/login', { method: 'POST', body: JSON.stringify({ phone: form.get('phone'), password: form.get('password') }) });
      saveSession(data.token, data.customer);
      fillCheckout();
      updateFloatButton();
      if (closeMobileAccountAfterAuth()) return;
      renderAccountModal('profile', 'Login realizado com sucesso.');
    } catch (error) {
      renderAccountModal('login', error.message);
    }
  });
}

function renderRegisterTab() {
  const body = document.querySelector('.account-body');
  body.innerHTML = `
    <form class="account-form" data-register-form>
      <div class="account-grid"><label>Nome<input name="name" required /></label><label>WhatsApp<input name="phone" required /></label></div>
      <div class="account-grid"><label>Senha<input name="password" type="password" required /></label><label>E-mail opcional<input name="email" type="email" /></label></div>
      <label>Endereco<input name="address" /></label>
      <div class="account-grid"><label>Bairro<input name="neighborhood" /></label><label>Referencia<input name="reference" /></label></div>
      <button>Criar cadastro</button>
    </form>
  `;
  body.querySelector('[data-register-form]').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload = Object.fromEntries(form.entries());
    payload.phone = digits(payload.phone);
    try {
      const data = await api('/api/customer/register', { method: 'POST', body: JSON.stringify(payload) });
      saveSession(data.token, data.customer);
      fillCheckout();
      updateFloatButton();
      if (closeMobileAccountAfterAuth()) return;
      renderAccountModal('profile', 'Cadastro criado com sucesso.');
    } catch (error) {
      renderAccountModal('register', error.message);
    }
  });
}

function renderProfileTab() {
  const body = document.querySelector('.account-body');
  const customer = accountState.customer;
  body.innerHTML = `
    <form class="account-form" data-profile-form>
      <div class="account-grid"><label>Nome<input name="name" value="${customer.name || ''}" required /></label><label>WhatsApp<input value="${customer.phone || ''}" disabled /></label></div>
      <label>E-mail<input name="email" value="${customer.email || ''}" /></label>
      <label>Endereco<input name="address" value="${customer.address || ''}" /></label>
      <div class="account-grid"><label>Bairro<input name="neighborhood" value="${customer.neighborhood || ''}" /></label><label>Referencia<input name="reference" value="${customer.reference || ''}" /></label></div>
      <button>Salvar dados</button>
    </form>
    <button class="account-logout" type="button">Sair da conta</button>
  `;
  body.querySelector('[data-profile-form]').addEventListener('submit', async (event) => {
    event.preventDefault();
    const payload = Object.fromEntries(new FormData(event.currentTarget).entries());
    try {
      const data = await api('/api/customer/profile', { method: 'PUT', body: JSON.stringify(payload) });
      saveSession(accountState.token, data.customer);
      fillCheckout();
      updateFloatButton();
      renderAccountModal('profile', 'Dados atualizados.');
    } catch (error) {
      renderAccountModal('profile', error.message);
    }
  });
  body.querySelector('.account-logout').addEventListener('click', logout);
}

async function renderOrdersTab() {
  const body = document.querySelector('.account-body');
  body.innerHTML = '<p class="account-loading">Carregando pedidos...</p>';
  try {
    const orders = await api('/api/customer/orders');
    accountState.orders = orders;
    body.innerHTML = orders.length ? `
      <div class="account-orders">
        ${orders.map((order) => `
          <article>
            <div><strong>${order.public_code || `#${order.id}`}</strong><span>${new Date(order.created_at).toLocaleString('pt-BR')}</span></div>
            <p>${(order.items || []).filter((item) => item.item_type === 'produto').map((item) => `${item.quantity}x ${item.name}`).join(' • ')}</p>
            <footer><b>${money(order.total)}</b><em>${order.status} / ${order.payment_status}</em><a href="/acompanhar?codigo=${order.public_code || order.id}&phone=${accountState.customer.phone}">Acompanhar</a></footer>
          </article>
        `).join('')}
      </div>
    ` : '<p class="account-loading">Voce ainda nao possui pedidos neste cadastro.</p>';
  } catch (error) {
    body.innerHTML = `<p class="account-loading">${error.message}</p>`;
  }
}

export function bootCustomerAccount() {
  if (accountState.booted) return;
  accountState.booted = true;
  window.hotdogOpenAccountModal = openAccountModal;
  setInterval(() => {
    syncSessionFromStorage();
    ensureFloatButton();
    fillCheckout();
  }, 1600);
  setTimeout(() => {
    syncSessionFromStorage();
    ensureFloatButton();
    fillCheckout();
  }, 900);
}

const orderRules = {
  booted: false,
  settings: null,
  open: true
};

function isPublicPage() {
  return !window.location.pathname.includes('admin') && !window.location.pathname.includes('cozinha') && !window.location.pathname.includes('entregas');
}

function brl(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0));
}

async function getSettings() {
  if (orderRules.settings) return orderRules.settings;
  try {
    const response = await fetch('/api/public/settings');
    orderRules.settings = await response.json();
    orderRules.open = Number(orderRules.settings?.is_open ?? 1) === 1;
  } catch {
    orderRules.settings = { is_open: 1 };
    orderRules.open = true;
  }
  return orderRules.settings;
}

function toast(message) {
  let item = document.querySelector('.order-rule-toast');
  if (!item) {
    item = document.createElement('div');
    item.className = 'order-rule-toast';
    document.body.appendChild(item);
  }
  item.textContent = message;
  item.classList.add('show');
  setTimeout(() => item.classList.remove('show'), 3000);
}

function injectStatusBanner() {
  if (document.querySelector('.store-status-banner')) return;
  const target = document.querySelector('.ultra-hero') || document.querySelector('main') || document.body;
  const banner = document.createElement('div');
  banner.className = `store-status-banner ${orderRules.open ? 'open' : 'closed'}`;
  banner.innerHTML = orderRules.open
    ? '<strong>Aberto agora</strong><span>Pedidos online liberados para hoje.</span>'
    : '<strong>Fechado no momento</strong><span>Voce pode montar o pedido, mas o envio fica bloqueado ate abrir.</span>';
  target.insertAdjacentElement(target === document.body ? 'afterbegin' : 'beforebegin', banner);
}

function selectedPayment() {
  const select = document.querySelector('.checkout-form select');
  return select?.value || '';
}

function injectChangeInput() {
  const form = document.querySelector('.checkout-form');
  if (!form) return;
  const select = form.querySelector('select');
  if (!select) return;
  let box = document.querySelector('.change-helper-card');
  if (!box) {
    box = document.createElement('div');
    box.className = 'change-helper-card';
    box.innerHTML = '<label>Troco para quanto?<input data-change-for type="number" min="0" step="0.01" placeholder="Ex.: 50,00" /></label><small>Use somente se o pagamento for em dinheiro.</small>';
    select.insertAdjacentElement('afterend', box);
  }
  box.style.display = selectedPayment() === 'dinheiro' ? 'block' : 'none';
}

function blockClosedStore() {
  const button = document.querySelector('.checkout-form .send-order');
  if (!button) return;
  if (!orderRules.open) {
    button.dataset.originalText = button.dataset.originalText || button.textContent;
    button.textContent = 'Loja fechada no momento';
    button.classList.add('store-closed-button');
  }
}

function installFetchRules() {
  if (window.__hotdogOrderRulesFetch) return;
  window.__hotdogOrderRulesFetch = true;
  const originalFetch = window.fetch.bind(window);
  window.fetch = async (input, init = {}) => {
    const url = typeof input === 'string' ? input : input?.url || '';
    const method = String(init?.method || 'GET').toUpperCase();
    if (url.includes('/api/orders') && method === 'POST') {
      await getSettings();
      if (!orderRules.open) {
        toast('A loja esta fechada no momento. Abra a loja no painel para receber pedidos.');
        return new Response(JSON.stringify({ message: 'Loja fechada no momento.' }), { status: 423, headers: { 'Content-Type': 'application/json' } });
      }
      try {
        const body = JSON.parse(init.body || '{}');
        const changeInput = document.querySelector('[data-change-for]');
        const changeFor = Number(changeInput?.value || 0);
        if (body.payment_method === 'dinheiro' && changeFor > 0) body.change_for = changeFor;
        init = { ...init, body: JSON.stringify(body) };
      } catch {
        // Mantem o corpo original se nao for JSON.
      }
    }
    return originalFetch(input, init);
  };
}

function installFormListeners() {
  const form = document.querySelector('.checkout-form');
  if (!form || form.dataset.orderRulesReady) return;
  form.dataset.orderRulesReady = '1';
  form.addEventListener('change', () => injectChangeInput());
  form.addEventListener('submit', (event) => {
    if (!orderRules.open) {
      event.preventDefault();
      toast('A loja esta fechada no momento.');
    }
  }, true);
}

async function bootPublicOrderRules() {
  if (orderRules.booted || !isPublicPage()) return;
  orderRules.booted = true;
  await getSettings();
  installFetchRules();
  setInterval(() => {
    injectStatusBanner();
    injectChangeInput();
    blockClosedStore();
    installFormListeners();
  }, 1200);
}

bootPublicOrderRules();

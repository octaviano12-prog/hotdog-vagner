const checkoutUx = { booted: false, settings: null };

function isPublicPage() {
  return !['/pedir', '/pedido-mobile', '/mobile'].some((path) => window.location.pathname === path || window.location.pathname.startsWith(`${path}/`))
    && !window.location.pathname.includes('admin') && !window.location.pathname.includes('cozinha') && !window.location.pathname.includes('entregas');
}

function digits(value = '') {
  return String(value || '').replace(/\D/g, '');
}

function brl(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0));
}

async function loadSettings() {
  if (checkoutUx.settings) return checkoutUx.settings;
  try {
    const response = await fetch('/api/public/settings');
    checkoutUx.settings = await response.json();
  } catch {
    checkoutUx.settings = {};
  }
  return checkoutUx.settings;
}

function showToast(message) {
  let toast = document.querySelector('.checkout-upgrade-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'checkout-upgrade-toast';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2800);
}

function orderCode(order = {}) {
  return order.public_code || (order.id ? `HD${String(order.id).padStart(4, '0')}` : 'pedido');
}

function customerPhoneFromForm() {
  const input = [...document.querySelectorAll('input')].find((field) => field.placeholder === 'WhatsApp');
  return digits(input?.value || '');
}

function successModal(order = {}) {
  const code = orderCode(order);
  const phone = customerPhoneFromForm();
  const total = order.total ? brl(order.total) : '';
  let modal = document.querySelector('.checkout-success-overlay');
  if (!modal) {
    modal = document.createElement('div');
    modal.className = 'checkout-success-overlay';
    modal.addEventListener('click', (event) => {
      if (event.target === modal) modal.remove();
    });
    document.body.appendChild(modal);
  }
  modal.innerHTML = `<section class="checkout-success-modal"><button type="button" class="checkout-success-close">×</button><div class="success-icon">✓</div><span>Pedido enviado</span><h2>${code}</h2><p>Seu pedido caiu no painel do Hot Dog do Vagner. Agora da para acompanhar o preparo e a entrega.</p><div class="success-grid"><article><strong>${total || '-'}</strong><small>Total</small></article><article><strong>${checkoutUx.settings?.estimated_delivery_minutes || 35} min</strong><small>Previsao</small></article></div><div class="success-actions"><a href="/acompanhar?codigo=${encodeURIComponent(code)}&phone=${encodeURIComponent(phone)}">Acompanhar pedido</a><button type="button" data-copy-code>Copiar codigo</button></div></section>`;
  modal.querySelector('.checkout-success-close').addEventListener('click', () => modal.remove());
  modal.querySelector('[data-copy-code]').addEventListener('click', async () => {
    await navigator.clipboard.writeText(code);
    showToast('Codigo copiado.');
  });
}

function installOrderSuccessHook() {
  if (window.__hotdogOrderSuccessHook) return;
  window.__hotdogOrderSuccessHook = true;
  const originalFetch = window.fetch.bind(window);
  window.fetch = async (input, init = {}) => {
    const response = await originalFetch(input, init);
    const url = typeof input === 'string' ? input : input?.url || '';
    const method = String(init?.method || 'GET').toUpperCase();
    if (url.includes('/api/orders') && method === 'POST' && response.ok) {
      response.clone().json().then((data) => {
        const order = data?.order || data;
        localStorage.setItem('hotdog_last_order', JSON.stringify(order));
        setTimeout(() => successModal(order), 450);
      }).catch(() => {});
    }
    return response;
  };
}

function pixKey() {
  return checkoutUx.settings?.pix_key || checkoutUx.settings?.pixKey || checkoutUx.settings?.pix || '';
}

function installPixHelper() {
  if (document.querySelector('.pix-helper-card')) return;
  const form = document.querySelector('.checkout-form');
  if (!form) return;
  const select = form.querySelector('select');
  if (!select) return;
  const card = document.createElement('div');
  card.className = 'pix-helper-card';
  card.innerHTML = `<div class="pix-fake-qr"><i></i><i></i><i></i><i></i></div><div><strong>Pagamento PIX</strong><p>Escolha PIX e copie a chave. O comprovante pode ser enviado pelo WhatsApp.</p><button type="button" data-copy-pix>Copiar chave PIX</button></div>`;
  select.insertAdjacentElement('afterend', card);
  card.querySelector('[data-copy-pix]').addEventListener('click', async () => {
    const key = pixKey();
    if (!key) return showToast('Cadastre a chave PIX nas configuracoes do painel.');
    await navigator.clipboard.writeText(key);
    showToast('Chave PIX copiada.');
  });
}

function installCheckoutGuide() {
  if (document.querySelector('.checkout-guide-strip')) return;
  const form = document.querySelector('.checkout-form');
  if (!form) return;
  const guide = document.createElement('div');
  guide.className = 'checkout-guide-strip';
  guide.innerHTML = '<span>1 Dados</span><span>2 Pagamento</span><span>3 Enviar</span><span>4 Acompanhar</span>';
  form.insertAdjacentElement('afterbegin', guide);
}

function installProductBadges() {
  document.querySelectorAll('.ultra-product-card').forEach((card, index) => {
    if (card.querySelector('.smart-product-badge')) return;
    const title = card.querySelector('h3')?.textContent || '';
    const badge = document.createElement('span');
    badge.className = 'smart-product-badge';
    badge.textContent = index === 0 ? 'Campeao da casa' : title.toLowerCase().includes('combo') ? 'Combo' : 'Feito na hora';
    card.querySelector('.product-photo-wrap')?.appendChild(badge);
  });
}

function bootPublicCheckoutUpgrade() {
  if (checkoutUx.booted || !isPublicPage()) return;
  checkoutUx.booted = true;
  loadSettings();
  installOrderSuccessHook();
  setInterval(() => {
    installCheckoutGuide();
    installPixHelper();
    installProductBadges();
  }, 1500);
}

bootPublicCheckoutUpgrade();


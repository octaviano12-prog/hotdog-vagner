const trackState = {
  booted: false,
  order: null,
  pollTimer: null
};

const statusSteps = [
  ['novo', 'Pedido recebido', 'Seu pedido entrou na fila da cozinha.', '▤'],
  ['preparo', 'Em preparação', 'A equipe esta preparando seu lanche.', '♨'],
  ['saiu_entrega', 'Saiu para entrega', 'O pedido saiu para entrega ou esta pronto para retirada.', '🛵'],
  ['concluido', 'Concluido', 'Pedido finalizado. Bom apetite!', '✓']
];

function money(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0));
}

function isTrackingPage() {
  return window.location.pathname.includes('acompanhar') || window.location.pathname.includes('pedido-status');
}

function isAdminPage() {
  return window.location.pathname.includes('admin');
}

function isMobileOrderPage() {
  return ['/pedir', '/pedido-mobile', '/mobile'].some((path) => window.location.pathname === path || window.location.pathname.startsWith(`${path}/`));
}

function params() {
  return new URLSearchParams(window.location.search);
}

function normalizeCode(value = '') {
  return String(value || '').trim().toUpperCase();
}

function normalizePhone(value = '') {
  return String(value || '').replace(/\D/g, '');
}

function mainItems(order) {
  return (order.items || []).filter((item) => item.item_type === 'produto');
}

function extrasFor(order, parentId) {
  return (order.items || []).filter((item) => item.item_type === 'adicional' && item.parent_item_id === parentId);
}

function statusIndex(status) {
  if (status === 'cancelado') return -1;
  return Math.max(0, statusSteps.findIndex(([key]) => key === status));
}

function statusTitle(status) {
  if (status === 'cancelado') return 'Cancelado';
  const index = statusIndex(status);
  return statusSteps[index]?.[1] || 'Pedido recebido';
}

function statusIcon(status) {
  if (status === 'cancelado') return '×';
  const index = statusIndex(status);
  return statusSteps[index]?.[3] || '▤';
}

function statusMessage(status) {
  if (status === 'cancelado') return 'Seu pedido foi cancelado.';
  if (status === 'preparo') return 'Seu pedido está sendo preparado com carinho.';
  if (status === 'saiu_entrega') return 'Seu pedido saiu para entrega.';
  if (status === 'concluido') return 'Pedido finalizado. Bom apetite!';
  return 'Seu pedido foi recebido e entrou na fila.';
}

function productIcon(name = '') {
  const value = name.toLowerCase();
  if (value.includes('suco')) return '🍊';
  if (value.includes('refrigerante') || value.includes('coca') || value.includes('guarana')) return '🥤';
  return '🌭';
}

async function fetchTrackedOrder(code, phone) {
  const response = await fetch(`/api/public/orders/${encodeURIComponent(normalizeCode(code))}?phone=${encodeURIComponent(normalizePhone(phone))}`);
  const data = await response.json();
  if (!response.ok) throw new Error(data?.message || 'Nao foi possivel consultar o pedido.');
  return data.order;
}

async function submitTrackingForm(form, shouldScroll = true) {
  const formData = new FormData(form);
  const nextCode = normalizeCode(formData.get('code'));
  const nextPhone = normalizePhone(formData.get('phone'));
  if (!nextCode || !nextPhone) return;
  await loadAndRender(nextCode, nextPhone, shouldScroll);
}

function renderTrackingRoot() {
  document.body.classList.add('tracking-route');
  let root = document.getElementById('tracking-root');
  if (!root) {
    root = document.createElement('div');
    root.id = 'tracking-root';
    document.body.appendChild(root);
  }

  const code = normalizeCode(params().get('codigo') || params().get('code') || '');
  const phone = normalizePhone(params().get('phone') || params().get('telefone') || '');

  root.innerHTML = `
    <main class="tracking-page">
      <section class="tracking-card tracking-hero">
        <a class="tracking-back" href="/pedir">← Voltar ao cardapio</a>
        <span class="tracking-pill">Acompanhe seu pedido</span>
        <h1>Status em tempo real do seu hot dog</h1>
        <p>Informe o codigo do pedido e os ultimos digitos do WhatsApp usado na compra.</p>
        <form class="tracking-form">
          <label>Codigo do pedido<input name="code" value="${code}" placeholder="Ex.: HD0007" required /></label>
          <label>WhatsApp<input name="phone" value="${phone}" placeholder="Ultimos 4 digitos ou numero completo" inputmode="numeric" required /></label>
          <button type="submit" data-track-submit>Consultar pedido</button>
        </form>
        <p class="tracking-message"></p>
      </section>
      <section class="tracking-card tracking-result" hidden></section>
    </main>
  `;

  const form = root.querySelector('.tracking-form');
  const submit = root.querySelector('[data-track-submit]');
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    await submitTrackingForm(form, true);
  });
  submit.addEventListener('click', async (event) => {
    event.preventDefault();
    await submitTrackingForm(form, true);
  });

  if (code && phone) loadAndRender(code, phone, false);
}

async function loadAndRender(code, phone, shouldScroll = false) {
  const root = document.getElementById('tracking-root');
  const message = root.querySelector('.tracking-message');
  const result = root.querySelector('.tracking-result');
  const hasRenderedOrder = Boolean(trackState.order) || !result.hidden;
  const isBackgroundRefresh = !shouldScroll && hasRenderedOrder;

  if (!isBackgroundRefresh) {
    message.textContent = 'Consultando pedido...';
    result.hidden = true;
  } else {
    message.textContent = '';
    result.classList.add('tracking-refreshing');
  }

  try {
    const order = await fetchTrackedOrder(code, phone);
    trackState.order = order;
    message.textContent = '';
    result.classList.remove('tracking-refreshing');
    renderOrder(order);
    const url = new URL(window.location.href);
    url.pathname = '/acompanhar';
    url.searchParams.set('codigo', order.public_code);
    url.searchParams.set('phone', normalizePhone(phone));
    window.history.replaceState({}, '', url);

    if (shouldScroll) {
      setTimeout(() => result.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
    }

    clearInterval(trackState.pollTimer);
    if (!['concluido', 'cancelado'].includes(order.status)) {
      trackState.pollTimer = setInterval(() => loadAndRender(order.public_code, phone, false), 12000);
    }
  } catch (error) {
    result.classList.remove('tracking-refreshing');
    if (isBackgroundRefresh) {
      message.textContent = 'Nao foi possivel atualizar agora. Tentaremos novamente em instantes.';
      return;
    }
    message.textContent = error.message;
    result.hidden = true;
    document.body.classList.remove('tracking-order-loaded');
  }
}

function renderOrder(order) {
  const root = document.getElementById('tracking-root');
  const result = root.querySelector('.tracking-result');
  const activeIndex = statusIndex(order.status);
  const canceled = order.status === 'cancelado';
  const created = order.created_at ? new Date(order.created_at).toLocaleString('pt-BR') : '';
  const activeTitle = statusTitle(order.status);
  const activeIcon = statusIcon(order.status);

  document.body.classList.add('tracking-order-loaded');
  result.hidden = false;
  result.innerHTML = `
    <header class="tracking-app-head">
      <a href="/pedir" aria-label="Voltar">←</a>
      <div><span>🌭</span><strong>HOTDOG PRENSADO</strong><small>Pedido mobile</small></div>
      <button type="button" onclick="window.hotdogOpenAccountModal?.()" aria-label="Conta">♡</button>
    </header>

    <section class="tracking-focus-card">
      <div class="tracking-code-box">
        <span>Código do pedido</span>
        <h2>${order.public_code}</h2>
        <p>${statusMessage(order.status)} ${!canceled && order.status === 'preparo' ? '<b>com carinho.</b>' : ''}</p>
      </div>
      <div class="tracking-focus-side">
        <strong class="tracking-status ${order.status}"><i>${activeIcon}</i>${activeTitle}</strong>
        <div><span>Previsão de entrega</span><b>35 <small>min</small></b></div>
      </div>
    </section>

    ${canceled ? `<div class="tracking-cancel">Pedido cancelado${order.cancellation_reason ? `: ${order.cancellation_reason}` : '.'}</div>` : `
      <section class="tracking-progress-card">
        ${statusSteps.map(([key, title, text, icon], index) => `
          <article class="${index <= activeIndex ? 'done' : ''} ${key === order.status ? 'active' : ''}">
            <b>${index + 1}</b>
            <i>${icon}</i>
            <strong>${title}</strong>
            <p>${text}</p>
          </article>
        `).join('')}
      </section>
    `}

    <h3 class="tracking-section-title"><span>▦</span>Detalhes do pedido</h3>
    <section class="tracking-detail-grid">
      <div><i>👤</i><span>Cliente</span><strong>${order.customer_name || '-'}</strong></div>
      <div><i>🛵</i><span>Entrega</span><strong>${order.delivery_type === 'retirada' ? 'Retirada' : 'Entrega'}</strong></div>
      <div><i>💳</i><span>Pagamento</span><strong>${order.payment_status === 'pago' ? 'Pago' : 'Pendente'} • ${order.payment_method || ''}</strong></div>
      <div><i>💰</i><span>Total</span><strong>${money(order.total)}</strong></div>
    </section>

    ${order.customer_address ? `<div class="tracking-address-premium"><i>📍</i><span>Endereço de entrega</span><strong>${order.customer_address}${order.customer_reference ? ` • ${order.customer_reference}` : ''}</strong></div>` : ''}

    <h3 class="tracking-section-title"><span>🧺</span>Itens do pedido</h3>
    <div class="tracking-items-premium">
      ${mainItems(order).map((item) => {
        const extras = extrasFor(order, item.id).map((extra) => extra.name).join(', ');
        return `<div><i>${productIcon(item.name)}</i><strong>${item.quantity}x ${item.name}${extras ? `<small>Extras: ${extras}</small>` : ''}</strong><b>${money(item.total_price)}</b></div>`;
      }).join('')}
    </div>

    <div class="tracking-actions tracking-actions-premium">
      <button type="button" onclick="window.location.reload()">⟳ Atualizar status</button>
      <a href="/pedir">⊕ Fazer novo pedido</a>
    </div>
  `;
}

function installFloatingTrackingLink() {
  if (isAdminPage() || isTrackingPage() || isMobileOrderPage() || document.querySelector('.track-order-float')) return;
  const link = document.createElement('a');
  link.className = 'track-order-float';
  link.href = '/acompanhar';
  link.innerHTML = '<span>📦</span><strong>Acompanhar pedido</strong>';
  document.body.appendChild(link);
}

export function bootCustomerTracking() {
  if (trackState.booted) return;
  trackState.booted = true;

  if (isTrackingPage()) {
    setTimeout(renderTrackingRoot, 0);
    return;
  }

  setTimeout(installFloatingTrackingLink, 1200);
}

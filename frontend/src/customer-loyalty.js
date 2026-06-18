const loyaltyState = {
  booted: false,
  loading: false,
  orders: [],
  lastLoaded: 0
};

const GOAL = 5;

function isAdminPage() {
  return window.location.pathname.includes('admin');
}

function isTrackingPage() {
  return window.location.pathname.includes('acompanhar') || window.location.pathname.includes('pedido-status');
}

function token() {
  return localStorage.getItem('hotdog_customer_token') || '';
}

function customer() {
  try {
    return JSON.parse(localStorage.getItem('hotdog_customer_profile') || 'null');
  } catch {
    return null;
  }
}

function money(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0));
}

async function customerRequest(path) {
  const response = await fetch(path, { headers: { Authorization: `Bearer ${token()}` } });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.message || 'Nao foi possivel carregar sua fidelidade.');
  return data;
}

async function loadOrders(force = false) {
  if (!token()) return [];
  if (!force && Date.now() - loyaltyState.lastLoaded < 6000 && loyaltyState.orders.length) return loyaltyState.orders;
  loyaltyState.loading = true;
  try {
    const orders = await customerRequest('/api/customer/orders');
    loyaltyState.orders = orders;
    loyaltyState.lastLoaded = Date.now();
    return orders;
  } finally {
    loyaltyState.loading = false;
  }
}

function paidValidOrders(orders) {
  return orders.filter((order) => order.status !== 'cancelado');
}

function favoriteItems(orders) {
  const map = new Map();
  orders.forEach((order) => {
    (order.items || []).filter((item) => item.item_type === 'produto').forEach((item) => {
      const key = item.name || 'Produto';
      const current = map.get(key) || { name: key, quantity: 0, total: 0 };
      current.quantity += Number(item.quantity || 0);
      current.total += Number(item.total_price || 0);
      map.set(key, current);
    });
  });
  return [...map.values()].sort((a, b) => b.quantity - a.quantity).slice(0, 4);
}

function loyaltyStats(orders) {
  const valid = paidValidOrders(orders);
  const paid = valid.filter((order) => order.payment_status === 'pago');
  const orderCount = valid.length;
  const paidCount = paid.length;
  const progress = orderCount % GOAL;
  const remaining = progress === 0 && orderCount > 0 ? 0 : GOAL - progress;
  const totalSpent = valid.reduce((sum, order) => sum + Number(order.total || 0), 0);
  const points = Math.floor(totalSpent / 10) + paidCount * 2;
  const rewards = Math.floor(orderCount / GOAL);

  return {
    valid,
    paid,
    orderCount,
    paidCount,
    progress: progress === 0 && orderCount > 0 ? GOAL : progress,
    remaining,
    totalSpent,
    points,
    rewards,
    favorites: favoriteItems(valid)
  };
}

function findAccountModal() {
  return document.querySelector('.customer-account-modal');
}

function attachLoyaltyTab(button) {
  if (!button || button.dataset.loyaltyReady) return;
  button.dataset.loyaltyReady = 'true';
  button.addEventListener('click', () => renderLoyaltyPanel());
}

function ensureLoyaltyTab() {
  const modal = findAccountModal();
  if (!modal || !customer() || !token()) return;
  const tabs = modal.querySelector('.account-tabs');
  if (!tabs) return;

  const existing = tabs.querySelector('[data-loyalty-tab]');
  if (existing) {
    attachLoyaltyTab(existing);
    return;
  }

  const button = document.createElement('button');
  button.type = 'button';
  button.dataset.loyaltyTab = 'true';
  button.textContent = 'Fidelidade';
  attachLoyaltyTab(button);
  tabs.appendChild(button);
}

async function renderLoyaltyPanel() {
  const modal = findAccountModal();
  const body = modal?.querySelector('.account-body');
  const message = modal?.querySelector('.account-message');
  if (!body) return;

  body.innerHTML = '<p class="account-loading">Carregando fidelidade...</p>';
  if (message) message.textContent = '';

  try {
    const orders = await loadOrders(true);
    const stats = loyaltyStats(orders);
    const percent = Math.min(100, Math.round((stats.progress / GOAL) * 100));
    const nextText = stats.remaining === 0
      ? 'Voce ja completou uma meta. Combine seu brinde no balcao/WhatsApp.'
      : `Faltam ${stats.remaining} pedido(s) para completar a meta.`;

    body.innerHTML = `
      <section class="loyalty-panel">
        <div class="loyalty-hero">
          <span>Programa fidelidade</span>
          <h3>Compre ${GOAL} vezes e ganhe vantagem</h3>
          <p>${nextText}</p>
          <div class="loyalty-bar"><i style="width:${percent}%"></i></div>
          <small>${stats.progress}/${GOAL} pedidos na meta atual</small>
        </div>
        <div class="loyalty-metrics">
          <article><span>Pedidos validos</span><strong>${stats.orderCount}</strong></article>
          <article><span>Pontos estimados</span><strong>${stats.points}</strong></article>
          <article><span>Premios liberados</span><strong>${stats.rewards}</strong></article>
          <article><span>Total consumido</span><strong>${money(stats.totalSpent)}</strong></article>
        </div>
        <div class="loyalty-rules">
          <strong>Como funciona</strong>
          <p>A cada pedido nao cancelado voce avanca na meta. Pagamentos marcados como pagos ajudam na pontuacao. O brinde/desconto pode ser confirmado pelo atendimento.</p>
        </div>
        <div class="loyalty-favorites">
          <strong>Seus favoritos</strong>
          ${stats.favorites.length ? stats.favorites.map((item) => `<div><span>${item.name}</span><b>${item.quantity}x</b></div>`).join('') : '<p>Quando voce fizer pedidos, seus favoritos aparecem aqui.</p>'}
        </div>
      </section>
    `;
  } catch (error) {
    body.innerHTML = `<p class="account-loading">${error.message}</p>`;
  }
}

window.hotdogRenderLoyaltyPanel = renderLoyaltyPanel;
window.addEventListener('hotdog-render-loyalty', () => renderLoyaltyPanel());

function ensureMiniBadge() {
  if (isAdminPage() || isTrackingPage() || !token() || document.querySelector('.loyalty-mini-badge')) return;
  const profile = customer();
  if (!profile) return;

  const badge = document.createElement('button');
  badge.type = 'button';
  badge.className = 'loyalty-mini-badge';
  badge.innerHTML = '<span>⭐</span><strong>Fidelidade</strong>';
  badge.addEventListener('click', () => {
    const accountButton = document.querySelector('.customer-account-float');
    accountButton?.click();
    setTimeout(renderLoyaltyPanel, 250);
  });
  document.body.appendChild(badge);
}

export function bootCustomerLoyalty() {
  if (loyaltyState.booted) return;
  loyaltyState.booted = true;

  setInterval(() => {
    ensureLoyaltyTab();
    ensureMiniBadge();
  }, 500);
}

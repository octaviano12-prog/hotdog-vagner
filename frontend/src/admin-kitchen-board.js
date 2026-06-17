const kitchenState = {
  booted: false,
  orders: [],
  lastMaxId: Number(localStorage.getItem('hotdog_kitchen_last_id') || 0),
  loading: false,
  timer: null
};

const columns = [
  { key: 'novo', title: 'Fila de pedidos', subtitle: 'Pedidos recebidos agora' },
  { key: 'preparo', title: 'Em preparação', subtitle: 'Cozinha montando o lanche' },
  { key: 'saiu_entrega', title: 'Saiu / pronto', subtitle: 'Entrega ou retirada' }
];

function isAdminPage() {
  return window.location.pathname.includes('admin');
}

function isKitchenPage() {
  return window.location.pathname.includes('cozinha');
}

function token() {
  return localStorage.getItem('hotdog_token') || '';
}

function money(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0));
}

function elapsed(value) {
  if (!value) return '';
  const minutes = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 60000));
  if (minutes < 1) return 'agora';
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}min`;
}

function mainItems(order) {
  return (order.items || []).filter((item) => item.item_type === 'produto');
}

function extrasFor(order, parentId) {
  return (order.items || []).filter((item) => item.item_type === 'adicional' && item.parent_item_id === parentId);
}

async function adminRequest(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token()}`,
      ...(options.headers || {})
    }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.message || 'Erro ao atualizar pedido.');
  return data;
}

async function loadKitchenOrders(force = false) {
  if (kitchenState.loading && !force) return;
  kitchenState.loading = true;
  try {
    const orders = await adminRequest('/api/admin/orders');
    const active = orders.filter((order) => ['novo', 'preparo', 'saiu_entrega'].includes(order.status));
    const maxId = Math.max(0, ...active.map((order) => Number(order.id || 0)));
    const hasNew = kitchenState.lastMaxId > 0 && active.some((order) => Number(order.id) > kitchenState.lastMaxId && order.status === 'novo');
    kitchenState.orders = active.sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0));
    if (maxId > kitchenState.lastMaxId) {
      kitchenState.lastMaxId = maxId;
      localStorage.setItem('hotdog_kitchen_last_id', String(maxId));
    }
    if (hasNew) playKitchenBell();
    renderKitchenBoard();
  } catch (error) {
    renderKitchenBoard(error.message);
  } finally {
    kitchenState.loading = false;
  }
}

function playKitchenBell() {
  try {
    const audio = new (window.AudioContext || window.webkitAudioContext)();
    const gain = audio.createGain();
    gain.gain.setValueAtTime(0.001, audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.18, audio.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.55);
    gain.connect(audio.destination);
    [660, 880, 990].forEach((freq, index) => {
      const osc = audio.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, audio.currentTime + index * 0.12);
      osc.connect(gain);
      osc.start(audio.currentTime + index * 0.12);
      osc.stop(audio.currentTime + index * 0.12 + 0.16);
    });
  } catch {
    // Audio pode ser bloqueado no navegador ate uma interacao do usuario.
  }
}

async function moveOrder(orderId, status, payment_status) {
  const body = payment_status ? { status, payment_status } : { status };
  await adminRequest(`/api/admin/orders/${orderId}/status-flow`, { method: 'PATCH', body: JSON.stringify(body) });
  await loadKitchenOrders(true);
}

async function markPaid(orderId) {
  await adminRequest(`/api/admin/orders/${orderId}/payment-flow`, { method: 'PATCH', body: JSON.stringify({ payment_status: 'pago' }) });
  await loadKitchenOrders(true);
}

function orderActions(order) {
  const actions = [];
  if (order.status === 'novo') actions.push(`<button data-move="preparo" data-id="${order.id}">Preparar</button>`);
  if (order.status === 'preparo') actions.push(`<button data-move="saiu_entrega" data-id="${order.id}">Saiu / pronto</button>`);
  if (order.status === 'saiu_entrega') actions.push(`<button data-move="concluido" data-id="${order.id}">Concluir</button>`);
  if (order.payment_status !== 'pago') actions.push(`<button data-paid="${order.id}">Pago</button>`);
  actions.push(`<button class="danger" data-cancel="${order.id}">Cancelar</button>`);
  return actions.join('');
}

function orderItemsHtml(order) {
  const products = mainItems(order);
  return products.map((item) => {
    const extras = extrasFor(order, item.id).map((extra) => extra.name).join(', ');
    return `<li><strong>${item.quantity}x ${item.name}</strong>${extras ? `<span>Extras: ${extras}</span>` : ''}${item.notes ? `<em>${item.notes}</em>` : ''}</li>`;
  }).join('') || '<li><strong>Sem itens</strong></li>';
}

function orderCard(order) {
  const code = order.public_code || `#${order.id}`;
  const late = Math.round((Date.now() - new Date(order.created_at || Date.now()).getTime()) / 60000) >= 35;
  return `
    <article class="kitchen-card ${late ? 'late' : ''}">
      <div class="kitchen-card-head">
        <div><span>Pedido</span><strong>${code}</strong></div>
        <b>${elapsed(order.created_at)}</b>
      </div>
      <h3>${order.customer_name || 'Cliente'}</h3>
      <p class="kitchen-meta">${order.delivery_type === 'retirada' ? 'Retirada' : 'Entrega'} • ${order.payment_method || ''} • ${order.payment_status || 'pendente'}</p>
      ${order.customer_address ? `<p class="kitchen-address">${order.customer_address}${order.customer_reference ? ` • ${order.customer_reference}` : ''}</p>` : ''}
      <ul>${orderItemsHtml(order)}</ul>
      ${order.notes ? `<p class="kitchen-note">Obs.: ${order.notes}</p>` : ''}
      <div class="kitchen-total"><span>Total</span><strong>${money(order.total)}</strong></div>
      <div class="kitchen-actions">${orderActions(order)}</div>
    </article>`;
}

function ensureKitchenRoot() {
  document.body.classList.add('kitchen-route');
  let root = document.getElementById('kitchen-root');
  if (!root) {
    root = document.createElement('div');
    root.id = 'kitchen-root';
    document.body.appendChild(root);
  }
  return root;
}

function renderKitchenBoard(message = '') {
  if (!isKitchenPage()) return;
  const root = ensureKitchenRoot();
  const activeCount = kitchenState.orders.length;
  root.innerHTML = `
    <main class="kitchen-board">
      <header class="kitchen-top">
        <div>
          <a href="/admin">← Voltar ao painel</a>
          <span>Modo cozinha / TV</span>
          <h1>Pedidos em produção</h1>
          <p>${activeCount} pedido(s) ativo(s) • atualização automática</p>
        </div>
        <div class="kitchen-top-actions">
          <strong>${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</strong>
          <button data-refresh>Atualizar</button>
          <button data-fullscreen>Tela cheia</button>
        </div>
      </header>
      ${message ? `<p class="kitchen-message">${message}</p>` : ''}
      ${!token() ? `<section class="kitchen-login"><h2>Acesse o painel primeiro</h2><p>Entre no admin para liberar a tela da cozinha.</p><a href="/admin">Ir para login admin</a></section>` : `
        <section class="kitchen-columns">
          ${columns.map((column) => {
            const orders = kitchenState.orders.filter((order) => order.status === column.key);
            return `<div class="kitchen-column ${column.key}"><header><div><h2>${column.title}</h2><p>${column.subtitle}</p></div><strong>${orders.length}</strong></header>${orders.length ? orders.map(orderCard).join('') : '<div class="kitchen-empty">Sem pedidos aqui</div>'}</div>`;
          }).join('')}
        </section>`}
    </main>`;

  root.querySelector('[data-refresh]')?.addEventListener('click', () => loadKitchenOrders(true));
  root.querySelector('[data-fullscreen]')?.addEventListener('click', () => document.documentElement.requestFullscreen?.());
  root.querySelectorAll('[data-move]').forEach((button) => {
    button.addEventListener('click', () => moveOrder(button.dataset.id, button.dataset.move));
  });
  root.querySelectorAll('[data-paid]').forEach((button) => {
    button.addEventListener('click', () => markPaid(button.dataset.paid));
  });
  root.querySelectorAll('[data-cancel]').forEach((button) => {
    button.addEventListener('click', () => {
      if (confirm('Cancelar este pedido?')) moveOrder(button.dataset.cancel, 'cancelado', 'cancelado');
    });
  });
}

function ensureKitchenShortcut() {
  if (!isAdminPage() || !token() || document.querySelector('.kitchen-shortcut')) return;
  const link = document.createElement('a');
  link.className = 'kitchen-shortcut';
  link.href = '/cozinha';
  link.innerHTML = '<span>🍳</span><strong>Modo cozinha</strong>';
  document.body.appendChild(link);
}

function bootKitchenBoard() {
  if (kitchenState.booted) return;
  kitchenState.booted = true;

  if (isKitchenPage()) {
    renderKitchenBoard('Carregando pedidos...');
    loadKitchenOrders(true);
    kitchenState.timer = setInterval(() => loadKitchenOrders(), 7000);
    return;
  }

  setInterval(ensureKitchenShortcut, 1300);
}

bootKitchenBoard();

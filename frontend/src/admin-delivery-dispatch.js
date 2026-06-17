const deliveryState = {
  booted: false,
  orders: [],
  search: '',
  payment: 'todos',
  loadedAt: 0,
  loading: false
};

const deliveryStatuses = ['preparo', 'saiu_entrega', 'novo'];

function isAdminPage() {
  return window.location.pathname.includes('admin');
}

function isDeliveryPage() {
  return window.location.pathname.includes('entregas');
}

function token() {
  return localStorage.getItem('hotdog_token') || '';
}

function digits(value = '') {
  return String(value || '').replace(/\D/g, '');
}

function text(value = '') {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function money(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0));
}

function elapsed(value) {
  if (!value) return '-';
  const minutes = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 60000));
  if (minutes < 1) return 'agora';
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}min`;
}

function orderCode(order) {
  return order.public_code || `#${order.id}`;
}

function mainItems(order) {
  return (order.items || []).filter((item) => item.item_type === 'produto');
}

function extrasFor(order, parentId) {
  return (order.items || []).filter((item) => item.item_type === 'adicional' && item.parent_item_id === parentId);
}

function orderAddress(order) {
  return [order.customer_address, order.delivery_neighborhood, order.customer_reference].filter(Boolean).join(' - ');
}

function mapsUrl(order) {
  const address = orderAddress(order);
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

function whatsappUrl(order) {
  const phone = digits(order.customer_phone || '');
  if (!phone) return '';
  const number = phone.startsWith('55') ? phone : `55${phone}`;
  const message = [
    `Oi ${order.customer_name || ''}, aqui e do Hot Dog do Vagner.`,
    `Seu pedido ${orderCode(order)} ${order.status === 'saiu_entrega' ? 'saiu para entrega' : 'esta sendo preparado'}.`,
    `Total: ${money(order.total)}`
  ].join('\n');
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
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
  if (!response.ok) throw new Error(data?.message || 'Erro na central de entregas.');
  return data;
}

async function loadDeliveries(force = false) {
  if (!token() || deliveryState.loading) return;
  if (!force && Date.now() - deliveryState.loadedAt < 7000 && deliveryState.orders.length) return;
  deliveryState.loading = true;
  try {
    const orders = await adminRequest('/api/admin/orders');
    deliveryState.orders = orders
      .filter((order) => order.delivery_type !== 'retirada')
      .filter((order) => !['concluido', 'cancelado'].includes(order.status))
      .sort((a, b) => {
        const priority = (status) => deliveryStatuses.indexOf(status) === -1 ? 99 : deliveryStatuses.indexOf(status);
        return priority(a.status) - priority(b.status) || new Date(a.created_at || 0) - new Date(b.created_at || 0);
      });
    deliveryState.loadedAt = Date.now();
    renderDeliveryBoard();
  } catch (error) {
    renderDeliveryBoard(error.message);
  } finally {
    deliveryState.loading = false;
  }
}

async function updateStatus(orderId, status, payment_status) {
  const body = payment_status ? { status, payment_status } : { status };
  await adminRequest(`/api/admin/orders/${orderId}/status-flow`, { method: 'PATCH', body: JSON.stringify(body) });
  await loadDeliveries(true);
}

async function updatePayment(orderId) {
  await adminRequest(`/api/admin/orders/${orderId}/payment-flow`, { method: 'PATCH', body: JSON.stringify({ payment_status: 'pago' }) });
  await loadDeliveries(true);
}

function filteredOrders() {
  const q = text(deliveryState.search);
  return deliveryState.orders.filter((order) => {
    const paymentOk = deliveryState.payment === 'todos' || order.payment_status === deliveryState.payment;
    const queryOk = !q || text(`${orderCode(order)} ${order.customer_name} ${order.customer_phone} ${order.customer_address} ${order.delivery_neighborhood} ${(order.items || []).map((item) => item.name).join(' ')}`).includes(q);
    return paymentOk && queryOk;
  });
}

function itemsHtml(order) {
  return mainItems(order).map((item) => {
    const extras = extrasFor(order, item.id).map((extra) => extra.name).join(', ');
    return `<li><strong>${item.quantity}x ${item.name}</strong>${extras ? `<span>Extras: ${extras}</span>` : ''}</li>`;
  }).join('') || '<li><strong>Sem itens</strong></li>';
}

function actionsHtml(order) {
  const whats = whatsappUrl(order);
  return `
    ${order.status !== 'saiu_entrega' ? `<button data-status="saiu_entrega" data-id="${order.id}">Saiu entrega</button>` : ''}
    <button data-status="concluido" data-id="${order.id}">Entregue</button>
    ${order.payment_status !== 'pago' ? `<button data-paid="${order.id}">Recebido</button>` : ''}
    <a href="${mapsUrl(order)}" target="_blank" rel="noreferrer">Mapa</a>
    ${whats ? `<a href="${whats}" target="_blank" rel="noreferrer">WhatsApp</a>` : ''}
  `;
}

function cardHtml(order) {
  const late = Math.round((Date.now() - new Date(order.created_at || Date.now()).getTime()) / 60000) >= 45;
  return `
    <article class="delivery-card ${order.status} ${late ? 'late' : ''}">
      <div class="delivery-card-head">
        <div><span>Pedido</span><strong>${orderCode(order)}</strong></div>
        <b>${elapsed(order.created_at)}</b>
      </div>
      <h3>${order.customer_name || 'Cliente'}</h3>
      <p class="delivery-phone">${order.customer_phone || ''}</p>
      <p class="delivery-address">${orderAddress(order) || 'Endereco nao informado'}</p>
      <div class="delivery-badges"><span>${order.status}</span><span>${order.payment_method || ''}</span><span>${order.payment_status || 'pendente'}</span></div>
      <ul>${itemsHtml(order)}</ul>
      ${order.notes ? `<p class="delivery-note">Obs.: ${order.notes}</p>` : ''}
      <div class="delivery-total"><span>Total</span><strong>${money(order.total)}</strong></div>
      <div class="delivery-actions">${actionsHtml(order)}</div>
    </article>
  `;
}

function ensureDeliveryRoot() {
  document.body.classList.add('delivery-route');
  let root = document.getElementById('delivery-root');
  if (!root) {
    root = document.createElement('div');
    root.id = 'delivery-root';
    document.body.appendChild(root);
  }
  return root;
}

function renderDeliveryBoard(message = '') {
  if (!isDeliveryPage()) return;
  const root = ensureDeliveryRoot();
  const list = filteredOrders();
  const pendingValue = list.filter((order) => order.payment_status === 'pendente').reduce((sum, order) => sum + Number(order.total || 0), 0);
  const routeValue = list.reduce((sum, order) => sum + Number(order.total || 0), 0);
  const ready = list.filter((order) => order.status === 'saiu_entrega').length;

  root.innerHTML = `
    <main class="delivery-dispatch">
      <header class="delivery-top">
        <div>
          <a href="/admin">← Voltar ao painel</a>
          <span>Central do entregador</span>
          <h1>Entregas em andamento</h1>
          <p>${list.length} pedido(s) para entrega • ${ready} pronto(s) para rua</p>
        </div>
        <div class="delivery-clock"><strong>${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</strong><button data-refresh>Atualizar</button></div>
      </header>
      <section class="delivery-toolbar">
        <label>🔎 <input data-search value="${deliveryState.search}" placeholder="Buscar pedido, cliente, bairro ou item" /></label>
        <select data-payment>
          <option value="todos" ${deliveryState.payment === 'todos' ? 'selected' : ''}>Todos pagamentos</option>
          <option value="pendente" ${deliveryState.payment === 'pendente' ? 'selected' : ''}>Pendentes</option>
          <option value="pago" ${deliveryState.payment === 'pago' ? 'selected' : ''}>Pagos</option>
        </select>
      </section>
      <section class="delivery-metrics">
        <article><span>Pedidos</span><strong>${list.length}</strong></article>
        <article><span>Na rua/prontos</span><strong>${ready}</strong></article>
        <article><span>Total rota</span><strong>${money(routeValue)}</strong></article>
        <article><span>A receber</span><strong>${money(pendingValue)}</strong></article>
      </section>
      ${message ? `<p class="delivery-message">${message}</p>` : ''}
      ${!token() ? `<section class="delivery-login"><h2>Acesse o admin primeiro</h2><p>Entre no painel para liberar a central de entregas.</p><a href="/admin">Ir para admin</a></section>` : `<section class="delivery-grid">${list.length ? list.map(cardHtml).join('') : '<div class="delivery-empty">Nenhuma entrega ativa.</div>'}</section>`}
    </main>`;

  root.querySelector('[data-refresh]')?.addEventListener('click', () => loadDeliveries(true));
  root.querySelector('[data-search]')?.addEventListener('input', (event) => {
    deliveryState.search = event.target.value;
    renderDeliveryBoard();
  });
  root.querySelector('[data-payment]')?.addEventListener('change', (event) => {
    deliveryState.payment = event.target.value;
    renderDeliveryBoard();
  });
  root.querySelectorAll('[data-status]').forEach((button) => button.addEventListener('click', () => updateStatus(button.dataset.id, button.dataset.status)));
  root.querySelectorAll('[data-paid]').forEach((button) => button.addEventListener('click', () => updatePayment(button.dataset.paid)));
}

function ensureDeliveryShortcut() {
  if (!isAdminPage() || !token() || document.querySelector('.delivery-shortcut')) return;
  const link = document.createElement('a');
  link.className = 'delivery-shortcut';
  link.href = '/entregas';
  link.innerHTML = '<span>🛵</span><strong>Entregas</strong>';
  document.body.appendChild(link);
}

function bootDeliveryDispatch() {
  if (deliveryState.booted) return;
  deliveryState.booted = true;

  if (isDeliveryPage()) {
    renderDeliveryBoard('Carregando entregas...');
    loadDeliveries(true);
    setInterval(() => loadDeliveries(), 9000);
    return;
  }

  setInterval(ensureDeliveryShortcut, 1300);
}

bootDeliveryDispatch();

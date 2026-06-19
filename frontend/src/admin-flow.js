const state = {
  booted: false,
  orders: [],
  orderMap: new Map(),
  lastFetch: 0,
  filter: { search: '', status: 'todos', payment: 'todos' }
};

function isAdminPage() {
  return window.location.pathname.includes('admin');
}

function token() {
  return localStorage.getItem('hotdog_token');
}

function money(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0));
}

function digits(value = '') {
  return String(value).replace(/\D/g, '');
}

function safeText(value = '') {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
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

function orderMessage(order) {
  const items = mainItems(order).map((item, index) => {
    const extras = extrasFor(order, item.id).map((extra) => extra.name).join(', ');
    return `${index + 1}. ${item.quantity}x ${item.name}${extras ? ` | Extras: ${extras}` : ''}`;
  });

  return [
    `Pedido ${orderCode(order)} - Hotdog Prensado`,
    '',
    ...items,
    '',
    `Cliente: ${order.customer_name || ''}`,
    `Telefone: ${order.customer_phone || ''}`,
    `Entrega: ${order.delivery_type === 'retirada' ? 'Retirada no balcao' : 'Entrega'}`,
    order.customer_address ? `Endereco: ${order.customer_address}` : '',
    order.delivery_neighborhood ? `Bairro: ${order.delivery_neighborhood}` : '',
    order.customer_reference ? `Referencia: ${order.customer_reference}` : '',
    `Pagamento: ${order.payment_method || ''} - ${order.payment_status || ''}`,
    order.notes ? `Observacoes: ${order.notes}` : '',
    `Total: ${money(order.total)}`
  ].filter(Boolean).join('\n');
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
  const contentType = response.headers.get('content-type') || '';
  const data = contentType.includes('application/json') ? await response.json() : await response.text();
  if (!response.ok) throw new Error(data?.message || 'Erro na operacao administrativa.');
  return data;
}

async function fetchOrders(force = false) {
  if (!isAdminPage() || !token()) return;
  if (!force && Date.now() - state.lastFetch < 6000) return;
  try {
    const orders = await adminRequest('/api/admin/orders');
    const previousMax = Number(localStorage.getItem('hotdog_last_order_id') || 0);
    const currentMax = Math.max(0, ...orders.map((order) => Number(order.id || 0)));
    const hasNew = previousMax > 0 && orders.some((order) => Number(order.id || 0) > previousMax && order.status === 'novo');

    state.orders = orders;
    state.orderMap = new Map(orders.map((order) => [orderCode(order), order]));
    state.lastFetch = Date.now();

    if (currentMax > previousMax) localStorage.setItem('hotdog_last_order_id', String(currentMax));
    if (hasNew && localStorage.getItem('hotdog_sound_enabled') !== 'off') playNewOrderSound();

    hydrateOrderCards();
    applyFilters();
  } catch {
    // Mantem o painel funcionando mesmo se a sessao expirar ou a rede oscilar.
  }
}

function playNewOrderSound() {
  try {
    const context = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(740, context.currentTime);
    oscillator.frequency.setValueAtTime(940, context.currentTime + 0.12);
    gain.gain.setValueAtTime(0.001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.16, context.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.4);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.42);
  } catch {
    // Navegadores mobile podem bloquear audio automatico.
  }
}

function ensureToolbar() {
  if (!isAdminPage()) return;
  const workspace = document.querySelector('.admin-workspace');
  const topbar = document.querySelector('.admin-topbar');
  if (!workspace || !topbar || document.querySelector('.admin-flow-toolbar')) return;

  const toolbar = document.createElement('section');
  toolbar.className = 'admin-flow-toolbar';
  toolbar.innerHTML = `
    <label class="flow-search">
      <span>🔎</span>
      <input data-flow-search placeholder="Buscar por cliente, telefone, codigo ou item" />
    </label>
    <select data-flow-status aria-label="Filtrar status">
      <option value="todos">Todos os status</option>
      <option value="novo">Novos</option>
      <option value="preparo">Em preparo</option>
      <option value="saiu_entrega">Saiu para entrega</option>
      <option value="concluido">Concluidos</option>
      <option value="cancelado">Cancelados</option>
    </select>
    <select data-flow-payment aria-label="Filtrar pagamento">
      <option value="todos">Todos pagamentos</option>
      <option value="pendente">Pagamento pendente</option>
      <option value="pago">Pagos</option>
      <option value="cancelado">Cancelados</option>
    </select>
    <button type="button" data-flow-sound>🔔 Som ligado</button>
    <button type="button" data-flow-print-day>🖨️ Imprimir pedidos</button>
  `;
  topbar.insertAdjacentElement('afterend', toolbar);

  toolbar.querySelector('[data-flow-search]').addEventListener('input', (event) => {
    state.filter.search = event.target.value;
    applyFilters();
  });
  toolbar.querySelector('[data-flow-status]').addEventListener('change', (event) => {
    state.filter.status = event.target.value;
    applyFilters();
  });
  toolbar.querySelector('[data-flow-payment]').addEventListener('change', (event) => {
    state.filter.payment = event.target.value;
    applyFilters();
  });
  toolbar.querySelector('[data-flow-sound]').addEventListener('click', (event) => {
    const nextOff = localStorage.getItem('hotdog_sound_enabled') !== 'off';
    localStorage.setItem('hotdog_sound_enabled', nextOff ? 'off' : 'on');
    event.currentTarget.textContent = nextOff ? '🔕 Som desligado' : '🔔 Som ligado';
    if (!nextOff) playNewOrderSound();
  });
  toolbar.querySelector('[data-flow-print-day]').addEventListener('click', () => printOrders(state.orders));
}

function findOrderForCard(card) {
  const code = card.querySelector('.order-head strong')?.textContent?.trim();
  if (code && state.orderMap.has(code)) return state.orderMap.get(code);
  if (code?.startsWith('#')) return state.orders.find((order) => `#${order.id}` === code);
  const customer = card.querySelector('h4')?.textContent?.trim();
  return state.orders.find((order) => order.customer_name === customer);
}

function hydrateOrderCards() {
  document.querySelectorAll('.kanban-card').forEach((card) => {
    const order = findOrderForCard(card);
    if (!order) return;
    card.dataset.flowSearch = safeText(`${orderCode(order)} ${order.customer_name} ${order.customer_phone} ${order.customer_address} ${order.delivery_neighborhood} ${(order.items || []).map((item) => item.name).join(' ')}`);
    card.dataset.flowStatus = order.status || '';
    card.dataset.flowPayment = order.payment_status || '';

    if (card.querySelector('.flow-extra-actions')) return;
    const actions = document.createElement('div');
    actions.className = 'flow-extra-actions';

    const phone = digits(order.customer_phone || '');
    if (phone) {
      const whats = document.createElement('a');
      whats.href = `https://wa.me/${phone.startsWith('55') ? phone : `55${phone}`}?text=${encodeURIComponent(orderMessage(order))}`;
      whats.target = '_blank';
      whats.rel = 'noreferrer';
      whats.textContent = 'WhatsApp';
      actions.appendChild(whats);
    }

    const print = document.createElement('button');
    print.type = 'button';
    print.textContent = 'Comanda';
    print.addEventListener('click', () => printOrders([order]));
    actions.appendChild(print);

    if (order.payment_status !== 'pago' && order.status !== 'cancelado') {
      const paid = document.createElement('button');
      paid.type = 'button';
      paid.textContent = 'Marcar pago';
      paid.addEventListener('click', async () => {
        await adminRequest(`/api/admin/orders/${order.id}/payment-flow`, { method: 'PATCH', body: JSON.stringify({ payment_status: 'pago' }) });
        await fetchOrders(true);
        window.location.reload();
      });
      actions.appendChild(paid);
    }

    card.appendChild(actions);
  });
}

function applyFilters() {
  const query = safeText(state.filter.search);
  document.querySelectorAll('.kanban-card').forEach((card) => {
    const statusOk = state.filter.status === 'todos' || card.dataset.flowStatus === state.filter.status || card.closest(`.kanban-column.${state.filter.status}`);
    const paymentOk = state.filter.payment === 'todos' || card.dataset.flowPayment === state.filter.payment;
    const searchOk = !query || safeText(card.dataset.flowSearch || card.textContent).includes(query);
    card.style.display = statusOk && paymentOk && searchOk ? '' : 'none';
  });

  document.querySelectorAll('.kanban-column').forEach((column) => {
    const visible = [...column.querySelectorAll('.kanban-card')].filter((card) => card.style.display !== 'none').length;
    column.classList.toggle('flow-empty-filter', visible === 0 && (query || state.filter.status !== 'todos' || state.filter.payment !== 'todos'));
  });
}

function printOrders(orders) {
  const list = Array.isArray(orders) ? orders : [];
  const html = `
    <html>
      <head>
        <title>Comanda - Hotdog Prensado</title>
        <style>
          body{font-family:Arial,sans-serif;margin:24px;color:#111} .order{border:2px solid #111;border-radius:12px;padding:16px;margin:0 0 18px;page-break-inside:avoid}
          h1,h2{margin:0 0 10px}.meta{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin:8px 0 12px}.items{border-top:1px dashed #444;border-bottom:1px dashed #444;padding:10px 0;margin:10px 0}.item{margin:6px 0}.total{font-size:22px;font-weight:900;text-align:right}.obs{font-weight:700}@media print{button{display:none}}
        </style>
      </head>
      <body>
        <button onclick="window.print()">Imprimir</button>
        <h1>Hotdog Prensado</h1>
        <p>Comanda gerada em ${new Date().toLocaleString('pt-BR')}</p>
        ${list.map((order) => `
          <section class="order">
            <h2>${orderCode(order)}</h2>
            <div class="meta">
              <span><b>Cliente:</b> ${order.customer_name || ''}</span>
              <span><b>Telefone:</b> ${order.customer_phone || ''}</span>
              <span><b>Entrega:</b> ${order.delivery_type === 'retirada' ? 'Retirada' : 'Entrega'}</span>
              <span><b>Pagamento:</b> ${order.payment_method || ''} / ${order.payment_status || ''}</span>
              <span><b>Endereco:</b> ${order.customer_address || '-'}</span>
              <span><b>Referencia:</b> ${order.customer_reference || '-'}</span>
            </div>
            <div class="items">
              ${mainItems(order).map((item) => {
                const extras = extrasFor(order, item.id).map((extra) => extra.name).join(', ');
                return `<div class="item"><b>${item.quantity}x ${item.name}</b>${extras ? `<br><small>Extras: ${extras}</small>` : ''}</div>`;
              }).join('')}
            </div>
            ${order.notes ? `<p class="obs">Obs.: ${order.notes}</p>` : ''}
            <div class="total">Total: ${money(order.total)}</div>
          </section>
        `).join('')}
        <script>setTimeout(()=>window.print(),300)</script>
      </body>
    </html>
  `;
  const win = window.open('', '_blank', 'width=720,height=900');
  if (!win) return;
  win.document.write(html);
  win.document.close();
}

function tick() {
  if (!isAdminPage()) return;
  ensureToolbar();
  fetchOrders();
  hydrateOrderCards();
  applyFilters();
}

function boot() {
  if (state.booted) return;
  state.booted = true;
  setInterval(tick, 1800);
  setInterval(() => fetchOrders(true), 10000);
  setTimeout(tick, 600);
}

boot();

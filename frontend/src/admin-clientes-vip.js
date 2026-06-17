const vipState = {
  booted: false,
  loadedAt: 0,
  customers: [],
  search: ''
};

function isAdminPage() {
  return window.location.pathname.includes('admin');
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

async function adminGet(path) {
  const response = await fetch(path, { headers: { Authorization: `Bearer ${token()}` } });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.message || 'Nao foi possivel carregar clientes.');
  return data;
}

function groupOrders(orders) {
  const map = new Map();
  orders.forEach((order) => {
    const phone = digits(order.customer_phone || '');
    const key = phone || text(order.customer_name || order.customer_id || order.id);
    const current = map.get(key) || {
      name: order.customer_name || 'Cliente sem nome',
      phone,
      neighborhood: order.delivery_neighborhood || '',
      address: order.customer_address || '',
      orders: 0,
      total: 0,
      pending: 0,
      last: order.created_at,
      productMap: new Map()
    };

    current.orders += 1;
    if (order.status !== 'cancelado') current.total += Number(order.total || 0);
    if (order.payment_status === 'pendente' && order.status !== 'cancelado') current.pending += Number(order.total || 0);
    if (new Date(order.created_at || 0) > new Date(current.last || 0)) {
      current.last = order.created_at;
      current.neighborhood = order.delivery_neighborhood || current.neighborhood;
      current.address = order.customer_address || current.address;
    }
    (order.items || []).filter((item) => item.item_type === 'produto').forEach((item) => {
      current.productMap.set(item.name, (current.productMap.get(item.name) || 0) + Number(item.quantity || 0));
    });
    map.set(key, current);
  });

  return [...map.values()].map((client) => {
    const fav = [...client.productMap.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || '-';
    return { ...client, favorite: fav, ticket: client.orders ? client.total / client.orders : 0 };
  }).sort((a, b) => b.total - a.total);
}

async function loadVip(force = false) {
  if (!token()) return;
  if (!force && Date.now() - vipState.loadedAt < 10000 && vipState.customers.length) return;
  const orders = await adminGet('/api/admin/orders');
  vipState.customers = groupOrders(orders);
  vipState.loadedAt = Date.now();
}

function visibleCustomers() {
  const q = text(vipState.search);
  if (!q) return vipState.customers;
  return vipState.customers.filter((client) => text(`${client.name} ${client.phone} ${client.neighborhood} ${client.address} ${client.favorite}`).includes(q));
}

function exportVipCsv(list) {
  const rows = [['Nome', 'Telefone', 'Bairro', 'Endereco', 'Pedidos', 'Total', 'Pendente', 'Ticket', 'Favorito'], ...list.map((client) => [client.name, client.phone, client.neighborhood, client.address, client.orders, client.total, client.pending, client.ticket, client.favorite])];
  const csv = rows.map((row) => row.map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`).join(';')).join('\n');
  const blob = new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `clientes-vip-hotdog-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

async function copyVip(list) {
  const content = ['Clientes VIP - Hot Dog do Vagner', '', ...list.slice(0, 12).map((client, index) => `${index + 1}. ${client.name} - ${money(client.total)} - ${client.orders} pedido(s)`)].join('\n');
  await navigator.clipboard.writeText(content);
  const message = document.querySelector('.clientes-vip-message');
  if (message) message.textContent = 'Lista copiada para WhatsApp.';
}

function closeVipPanel() {
  document.querySelector('.clientes-vip-overlay')?.remove();
}

function renderVipPanel(message = '') {
  let overlay = document.querySelector('.clientes-vip-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.className = 'clientes-vip-overlay';
    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) closeVipPanel();
    });
    document.body.appendChild(overlay);
  }

  const list = visibleCustomers();
  const revenue = list.reduce((sum, client) => sum + client.total, 0);
  const pending = list.reduce((sum, client) => sum + client.pending, 0);
  const vip = list.filter((client) => client.orders >= 3).length;

  overlay.innerHTML = `
    <section class="clientes-vip-panel">
      <button class="clientes-vip-close" type="button">×</button>
      <header>
        <span>Delivery inteligente</span>
        <h2>Clientes VIP</h2>
        <p>Controle quem mais compra, veja pendencias, favoritos e chame pelo WhatsApp.</p>
      </header>
      <div class="clientes-vip-actions">
        <label>🔎 <input data-vip-search value="${vipState.search}" placeholder="Buscar cliente, telefone, bairro ou produto" /></label>
        <button data-vip-refresh type="button">Atualizar</button>
        <button data-vip-copy type="button">Copiar VIP</button>
        <button data-vip-export type="button">Exportar Excel</button>
      </div>
      <div class="clientes-vip-metrics">
        <article><span>Clientes</span><strong>${list.length}</strong></article>
        <article><span>VIPs</span><strong>${vip}</strong></article>
        <article><span>Faturamento</span><strong>${money(revenue)}</strong></article>
        <article><span>Pendente</span><strong>${money(pending)}</strong></article>
      </div>
      <p class="clientes-vip-message">${message}</p>
      <div class="clientes-vip-list">
        ${list.length ? list.map((client) => {
          const phone = client.phone ? (client.phone.startsWith('55') ? client.phone : `55${client.phone}`) : '';
          return `
            <article>
              <div class="vip-head"><div><strong>${client.name}</strong><span>${client.phone || 'Sem telefone'}</span></div><b>${money(client.total)}</b></div>
              <div class="vip-tags"><span>${client.orders} pedido(s)</span><span>Ticket ${money(client.ticket)}</span><span>Favorito: ${client.favorite}</span></div>
              <p>${client.neighborhood || 'Bairro nao informado'} ${client.address ? `• ${client.address}` : ''}</p>
              <footer>${phone ? `<a target="_blank" rel="noreferrer" href="https://wa.me/${phone}?text=${encodeURIComponent(`Oi ${client.name}, tudo bem? Aqui e do Hot Dog do Vagner.`)}">WhatsApp</a>` : ''}${client.pending > 0 ? `<em>Pendente ${money(client.pending)}</em>` : '<em>Sem pendencia</em>'}${client.orders >= 3 ? '<mark>VIP</mark>' : ''}</footer>
            </article>`;
        }).join('') : '<div class="vip-empty">Nenhum cliente encontrado.</div>'}
      </div>
    </section>`;

  overlay.querySelector('.clientes-vip-close').addEventListener('click', closeVipPanel);
  overlay.querySelector('[data-vip-search]').addEventListener('input', (event) => {
    vipState.search = event.target.value;
    renderVipPanel();
  });
  overlay.querySelector('[data-vip-refresh]').addEventListener('click', async () => {
    renderVipPanel('Atualizando...');
    await loadVip(true);
    renderVipPanel();
  });
  overlay.querySelector('[data-vip-export]').addEventListener('click', () => exportVipCsv(visibleCustomers()));
  overlay.querySelector('[data-vip-copy]').addEventListener('click', () => copyVip(visibleCustomers()));
}

function ensureVipButton() {
  if (!isAdminPage() || !token() || document.querySelector('.clientes-vip-dock')) return;
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'clientes-vip-dock';
  button.innerHTML = '<span>👥</span><strong>Clientes VIP</strong>';
  button.addEventListener('click', async () => {
    renderVipPanel('Carregando...');
    try {
      await loadVip(true);
      renderVipPanel();
    } catch (error) {
      renderVipPanel(error.message);
    }
  });
  document.body.appendChild(button);
}

function bootClientesVip() {
  if (vipState.booted) return;
  vipState.booted = true;
  setInterval(() => {
    if (!isAdminPage()) return;
    ensureVipButton();
  }, 1300);
}

bootClientesVip();

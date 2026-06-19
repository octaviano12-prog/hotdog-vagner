const crmState = {
  booted: false,
  open: false,
  orders: [],
  customers: [],
  loadedAt: 0,
  filter: ''
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

function money(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0));
}

function safeText(value = '') {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function formatDate(value) {
  if (!value) return '-';
  try {
    return new Date(value).toLocaleDateString('pt-BR');
  } catch {
    return '-';
  }
}

async function adminGet(path) {
  const response = await fetch(path, { headers: { Authorization: `Bearer ${token()}` } });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.message || 'Nao foi possivel carregar clientes.');
  return data;
}

function groupCustomers(orders) {
  const map = new Map();
  orders.forEach((order) => {
    const phone = digits(order.customer_phone || '');
    const key = phone || safeText(order.customer_name || `cliente-${order.customer_id || order.id}`);
    const current = map.get(key) || {
      key,
      name: order.customer_name || 'Cliente sem nome',
      phone,
      address: order.customer_address || '',
      neighborhood: order.delivery_neighborhood || '',
      reference: order.customer_reference || '',
      orders: 0,
      paidOrders: 0,
      canceled: 0,
      total: 0,
      pending: 0,
      lastOrderAt: order.created_at,
      lastOrderCode: order.public_code || `#${order.id}`,
      favoriteMap: new Map()
    };

    current.orders += 1;
    if (order.status === 'cancelado') current.canceled += 1;
    if (order.payment_status === 'pago') current.paidOrders += 1;
    if (order.payment_status === 'pendente' && order.status !== 'cancelado') current.pending += Number(order.total || 0);
    if (order.status !== 'cancelado') current.total += Number(order.total || 0);
    if (new Date(order.created_at || 0) > new Date(current.lastOrderAt || 0)) {
      current.lastOrderAt = order.created_at;
      current.lastOrderCode = order.public_code || `#${order.id}`;
      current.address = order.customer_address || current.address;
      current.neighborhood = order.delivery_neighborhood || current.neighborhood;
      current.reference = order.customer_reference || current.reference;
    }

    (order.items || []).filter((item) => item.item_type === 'produto').forEach((item) => {
      const name = item.name || 'Produto';
      current.favoriteMap.set(name, (current.favoriteMap.get(name) || 0) + Number(item.quantity || 0));
    });

    map.set(key, current);
  });

  return [...map.values()].map((customer) => {
    const favorites = [...customer.favoriteMap.entries()].sort((a, b) => b[1] - a[1]);
    return {
      ...customer,
      ticket: customer.orders ? customer.total / customer.orders : 0,
      favorite: favorites[0]?.[0] || '-',
      whatsapp: customer.phone ? `https://wa.me/${customer.phone.startsWith('55') ? customer.phone : `55${customer.phone}`}` : ''
    };
  }).sort((a, b) => b.total - a.total);
}

async function loadCrm(force = false) {
  if (!token()) return;
  if (!force && Date.now() - crmState.loadedAt < 9000 && crmState.customers.length) return;
  const orders = await adminGet('/api/admin/orders');
  crmState.orders = orders;
  crmState.customers = groupCustomers(orders);
  crmState.loadedAt = Date.now();
}

function ensureCrmDock() {
  if (!isAdminPage() || !token() || document.querySelector('.crm-dock')) return;
  const dock = document.createElement('button');
  dock.type = 'button';
  dock.className = 'crm-dock';
  dock.innerHTML = '<span>👥</span><strong>Clientes CRM</strong>';
  dock.addEventListener('click', async () => {
    crmState.open = true;
    renderCrmPanel('Carregando clientes...');
    try {
      await loadCrm(true);
      renderCrmPanel();
    } catch (error) {
      renderCrmPanel(error.message);
    }
  });
  document.body.appendChild(dock);
}

function closeCrmPanel() {
  crmState.open = false;
  document.querySelector('.crm-overlay')?.remove();
}

function exportCsv(customers) {
  const header = ['Cliente', 'Telefone', 'Bairro', 'Endereco', 'Pedidos', 'Pagos', 'Cancelados', 'Pendente', 'Total', 'Ticket Medio', 'Ultimo Pedido', 'Favorito'];
  const rows = [header, ...customers.map((customer) => [
    customer.name,
    customer.phone,
    customer.neighborhood,
    customer.address,
    customer.orders,
    customer.paidOrders,
    customer.canceled,
    customer.pending,
    customer.total,
    customer.ticket,
    customer.lastOrderCode,
    customer.favorite
  ])];
  const csv = rows.map((row) => row.map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`).join(';')).join('\n');
  const blob = new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `clientes-hotdog-vagner-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function campaignText(customers) {
  const top = customers.slice(0, 10).map((customer, index) => `${index + 1}. ${customer.name} - ${money(customer.total)} - ${customer.orders} pedido(s)`).join('\n');
  return `Clientes VIP - Hotdog Prensado\n\n${top}\n\nSugestao: enviar promocao para clientes mais frequentes.`;
}

async function copyCampaign(customers) {
  await navigator.clipboard.writeText(campaignText(customers));
  const message = document.querySelector('.crm-message');
  if (message) message.textContent = 'Lista VIP copiada para WhatsApp.';
}

function filteredCustomers() {
  const filter = safeText(crmState.filter);
  if (!filter) return crmState.customers;
  return crmState.customers.filter((customer) => safeText(`${customer.name} ${customer.phone} ${customer.neighborhood} ${customer.address} ${customer.favorite}`).includes(filter));
}

function renderCrmPanel(message = '') {
  let overlay = document.querySelector('.crm-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.className = 'crm-overlay';
    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) closeCrmPanel();
    });
    document.body.appendChild(overlay);
  }

  const customers = filteredCustomers();
  const totalRevenue = customers.reduce((sum, customer) => sum + customer.total, 0);
  const pending = customers.reduce((sum, customer) => sum + customer.pending, 0);
  const vip = customers.filter((customer) => customer.orders >= 3).length;

  overlay.innerHTML = `
    <section class="crm-panel">
      <button class="crm-close" type="button">×</button>
      <header>
        <span>Clientes e delivery</span>
        <h2>CRM de clientes</h2>
        <p>Veja quem mais compra, valores pendentes, favoritos e chame direto no WhatsApp.</p>
      </header>
      <div class="crm-actions">
        <label>🔎 <input data-crm-search value="${crmState.filter}" placeholder="Buscar cliente, telefone, bairro ou produto" /></label>
        <button type="button" data-crm-refresh>Atualizar</button>
        <button type="button" data-crm-copy>Copiar VIP</button>
        <button type="button" data-crm-export>Exportar CSV</button>
      </div>
      <div class="crm-metrics">
        <article><span>Clientes</span><strong>${customers.length}</strong></article>
        <article><span>Clientes VIP</span><strong>${vip}</strong></article>
        <article><span>Faturamento</span><strong>${money(totalRevenue)}</strong></article>
        <article><span>Pendente</span><strong>${money(pending)}</strong></article>
      </div>
      <p class="crm-message">${message}</p>
      <div class="crm-list">
        ${customers.length ? customers.map((customer) => `
          <article>
            <div class="crm-customer-head">
              <div><strong>${customer.name}</strong><span>${customer.phone || 'Sem telefone'}</span></div>
              <b>${money(customer.total)}</b>
            </div>
            <div class="crm-customer-meta">
              <span>${customer.orders} pedido(s)</span>
              <span>Ticket ${money(customer.ticket)}</span>
              <span>Ultimo ${formatDate(customer.lastOrderAt)}</span>
              <span>Favorito: ${customer.favorite}</span>
            </div>
            <p>${customer.neighborhood || 'Bairro nao informado'} ${customer.address ? `• ${customer.address}` : ''}</p>
            <footer>
              ${customer.whatsapp ? `<a href="${customer.whatsapp}?text=${encodeURIComponent(`Oi ${customer.name}, tudo bem? Aqui e do Hotdog Prensado.`)}" target="_blank" rel="noreferrer">WhatsApp</a>` : ''}
              ${customer.pending > 0 ? `<em>Pendente ${money(customer.pending)}</em>` : '<em>Sem pendencia</em>'}
              ${customer.orders >= 3 ? '<mark>VIP</mark>' : ''}
            </footer>
          </article>
        `).join('') : '<div class="crm-empty">Nenhum cliente encontrado.</div>'}
      </div>
    </section>
  `;

  overlay.querySelector('.crm-close').addEventListener('click', closeCrmPanel);
  overlay.querySelector('[data-crm-search]').addEventListener('input', (event) => {
    crmState.filter = event.target.value;
    renderCrmPanel();
  });
  overlay.querySelector('[data-crm-refresh]').addEventListener('click', async () => {
    renderCrmPanel('Atualizando...');
    await loadCrm(true);
    renderCrmPanel();
  });
  overlay.querySelector('[data-crm-export]').addEventListener('click', () => exportCsv(filteredCustomers()));
  overlay.querySelector('[data-crm-copy]').addEventListener('click', () => copyCampaign(filteredCustomers()));
}

export function bootAdminCustomerCrm() {
  if (crmState.booted) return;
  crmState.booted = true;
  setInterval(() => {
    if (!isAdminPage()) return;
    ensureCrmDock();
  }, 1300);
}

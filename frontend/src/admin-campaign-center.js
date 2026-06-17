const campaignState = {
  booted: false,
  orders: [],
  customers: [],
  segment: 'vip',
  loadedAt: 0,
  message: ''
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

function normalizeText(value = '') {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function money(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0));
}

function daysSince(value) {
  if (!value) return 999;
  return Math.floor((Date.now() - new Date(value).getTime()) / 86400000);
}

async function adminGet(path) {
  const response = await fetch(path, { headers: { Authorization: `Bearer ${token()}` } });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.message || 'Nao foi possivel carregar campanhas.');
  return data;
}

function groupCustomers(orders) {
  const map = new Map();
  orders.forEach((order) => {
    const phone = digits(order.customer_phone || '');
    const key = phone || normalizeText(order.customer_name || order.customer_id || order.id);
    const current = map.get(key) || {
      key,
      name: order.customer_name || 'Cliente',
      phone,
      address: order.customer_address || '',
      neighborhood: order.delivery_neighborhood || '',
      orders: 0,
      total: 0,
      pending: 0,
      canceled: 0,
      lastAt: order.created_at,
      favorites: new Map()
    };

    current.orders += 1;
    if (order.status === 'cancelado') current.canceled += 1;
    if (order.status !== 'cancelado') current.total += Number(order.total || 0);
    if (order.payment_status === 'pendente' && order.status !== 'cancelado') current.pending += Number(order.total || 0);
    if (new Date(order.created_at || 0) > new Date(current.lastAt || 0)) {
      current.lastAt = order.created_at;
      current.address = order.customer_address || current.address;
      current.neighborhood = order.delivery_neighborhood || current.neighborhood;
    }

    (order.items || []).filter((item) => item.item_type === 'produto').forEach((item) => {
      const name = item.name || 'Produto';
      current.favorites.set(name, (current.favorites.get(name) || 0) + Number(item.quantity || 0));
    });

    map.set(key, current);
  });

  return [...map.values()].map((customer) => {
    const favorite = [...customer.favorites.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || 'hot dog prensado';
    return {
      ...customer,
      favorite,
      days: daysSince(customer.lastAt),
      ticket: customer.orders ? customer.total / customer.orders : 0
    };
  }).sort((a, b) => b.total - a.total);
}

async function loadCampaignData(force = false) {
  if (!token()) return;
  if (!force && Date.now() - campaignState.loadedAt < 10000 && campaignState.customers.length) return;
  const orders = await adminGet('/api/admin/orders');
  campaignState.orders = orders;
  campaignState.customers = groupCustomers(orders);
  campaignState.loadedAt = Date.now();
}

function segmentCustomers() {
  const list = campaignState.customers;
  if (campaignState.segment === 'vip') return list.filter((customer) => customer.orders >= 3 || customer.total >= 80);
  if (campaignState.segment === 'sumidos') return list.filter((customer) => customer.orders > 0 && customer.days >= 14);
  if (campaignState.segment === 'pendentes') return list.filter((customer) => customer.pending > 0);
  if (campaignState.segment === 'novos') return list.filter((customer) => customer.orders <= 1);
  return list;
}

function templateFor(segment, customer = {}) {
  const firstName = String(customer.name || 'cliente').split(' ')[0];
  if (segment === 'vip') {
    return `Oi ${firstName}, tudo bem? Aqui e do Hot Dog do Vagner. Hoje tem promocao especial para cliente VIP. Seu favorito ${customer.favorite || 'hot dog prensado'} esta te esperando. Quer que eu ja separe seu pedido?`;
  }
  if (segment === 'sumidos') {
    return `Oi ${firstName}, sentimos sua falta no Hot Dog do Vagner. Hoje e um bom dia para matar a saudade daquele hot dog prensado caprichado. Quer ver o cardapio?`;
  }
  if (segment === 'pendentes') {
    return `Oi ${firstName}, aqui e do Hot Dog do Vagner. Consta um valor pendente de ${money(customer.pending)} no seu cadastro. Posso te ajudar a regularizar?`;
  }
  if (segment === 'novos') {
    return `Oi ${firstName}, seja bem-vindo ao Hot Dog do Vagner. Na proxima compra voce pode acompanhar tudo pelo site e pedir novamente mais rapido. Quer receber uma sugestao de combo?`;
  }
  return `Oi ${firstName}, aqui e do Hot Dog do Vagner. Temos novidades no cardapio hoje. Quer receber uma sugestao?`;
}

function whatsappLink(customer, customMessage) {
  const phone = digits(customer.phone || '');
  if (!phone) return '';
  const number = phone.startsWith('55') ? phone : `55${phone}`;
  return `https://wa.me/${number}?text=${encodeURIComponent(customMessage || templateFor(campaignState.segment, customer))}`;
}

function csvValue(value) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

function exportCampaignCsv(list) {
  const rows = [
    ['Cliente', 'Telefone', 'Segmento', 'Pedidos', 'Total', 'Pendente', 'Ultima compra dias', 'Favorito', 'Mensagem'],
    ...list.map((customer) => [customer.name, customer.phone, campaignState.segment, customer.orders, customer.total, customer.pending, customer.days, customer.favorite, templateFor(campaignState.segment, customer)])
  ];
  const csv = rows.map((row) => row.map(csvValue).join(';')).join('\n');
  const blob = new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `campanha-${campaignState.segment}-hotdog-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

async function copyCampaignList(list) {
  const text = [
    `Campanha ${campaignState.segment.toUpperCase()} - Hot Dog do Vagner`,
    '',
    ...list.slice(0, 20).map((customer, index) => `${index + 1}. ${customer.name} - ${customer.phone || 'sem telefone'} - ${templateFor(campaignState.segment, customer)}`)
  ].join('\n');
  await navigator.clipboard.writeText(text);
  renderCampaignPanel('Campanha copiada para WhatsApp.');
}

function closeCampaignPanel() {
  document.querySelector('.campaign-overlay')?.remove();
}

function renderCampaignPanel(message = '') {
  let overlay = document.querySelector('.campaign-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.className = 'campaign-overlay';
    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) closeCampaignPanel();
    });
    document.body.appendChild(overlay);
  }

  const list = segmentCustomers();
  const totalRevenue = list.reduce((sum, customer) => sum + customer.total, 0);
  const totalPending = list.reduce((sum, customer) => sum + customer.pending, 0);
  const preview = list[0] ? templateFor(campaignState.segment, list[0]) : 'Escolha um segmento para gerar a mensagem.';

  overlay.innerHTML = `
    <section class="campaign-panel">
      <button class="campaign-close" type="button">×</button>
      <header>
        <span>Marketing do delivery</span>
        <h2>Central de campanhas</h2>
        <p>Separe clientes por perfil, copie mensagens prontas e chame direto no WhatsApp.</p>
      </header>
      <div class="campaign-controls">
        <label>Segmento
          <select data-campaign-segment>
            <option value="vip" ${campaignState.segment === 'vip' ? 'selected' : ''}>Clientes VIP</option>
            <option value="sumidos" ${campaignState.segment === 'sumidos' ? 'selected' : ''}>Clientes sumidos</option>
            <option value="pendentes" ${campaignState.segment === 'pendentes' ? 'selected' : ''}>Pendentes de pagamento</option>
            <option value="novos" ${campaignState.segment === 'novos' ? 'selected' : ''}>Clientes novos</option>
            <option value="todos" ${campaignState.segment === 'todos' ? 'selected' : ''}>Todos os clientes</option>
          </select>
        </label>
        <button data-campaign-refresh type="button">Atualizar</button>
        <button data-campaign-copy type="button">Copiar lista</button>
        <button data-campaign-export type="button">Exportar CSV</button>
      </div>
      <div class="campaign-metrics">
        <article><span>Clientes no alvo</span><strong>${list.length}</strong></article>
        <article><span>Total consumido</span><strong>${money(totalRevenue)}</strong></article>
        <article><span>Pendente</span><strong>${money(totalPending)}</strong></article>
        <article><span>Pedidos médios</span><strong>${list.length ? Math.round(list.reduce((sum, customer) => sum + customer.orders, 0) / list.length) : 0}</strong></article>
      </div>
      <div class="campaign-preview"><strong>Mensagem exemplo</strong><p>${preview}</p></div>
      <p class="campaign-message">${message}</p>
      <div class="campaign-list">
        ${list.length ? list.map((customer) => {
          const link = whatsappLink(customer);
          return `<article>
            <div><strong>${customer.name}</strong><span>${customer.phone || 'Sem telefone'} • ${customer.neighborhood || 'Bairro nao informado'}</span></div>
            <p>${templateFor(campaignState.segment, customer)}</p>
            <footer><span>${customer.orders} pedido(s)</span><span>${money(customer.total)}</span><span>Favorito: ${customer.favorite}</span>${link ? `<a href="${link}" target="_blank" rel="noreferrer">Enviar WhatsApp</a>` : ''}</footer>
          </article>`;
        }).join('') : '<div class="campaign-empty">Nenhum cliente neste segmento.</div>'}
      </div>
    </section>`;

  overlay.querySelector('.campaign-close').addEventListener('click', closeCampaignPanel);
  overlay.querySelector('[data-campaign-segment]').addEventListener('change', (event) => {
    campaignState.segment = event.target.value;
    renderCampaignPanel();
  });
  overlay.querySelector('[data-campaign-refresh]').addEventListener('click', async () => {
    renderCampaignPanel('Atualizando...');
    await loadCampaignData(true);
    renderCampaignPanel();
  });
  overlay.querySelector('[data-campaign-copy]').addEventListener('click', () => copyCampaignList(segmentCustomers()));
  overlay.querySelector('[data-campaign-export]').addEventListener('click', () => exportCampaignCsv(segmentCustomers()));
}

function ensureCampaignDock() {
  if (!isAdminPage() || !token() || document.querySelector('.campaign-dock')) return;
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'campaign-dock';
  button.innerHTML = '<span>📣</span><strong>Campanhas</strong>';
  button.addEventListener('click', async () => {
    renderCampaignPanel('Carregando campanhas...');
    try {
      await loadCampaignData(true);
      renderCampaignPanel();
    } catch (error) {
      renderCampaignPanel(error.message);
    }
  });
  document.body.appendChild(button);
}

function bootCampaignCenter() {
  if (campaignState.booted) return;
  campaignState.booted = true;
  setInterval(() => {
    if (!isAdminPage()) return;
    ensureCampaignDock();
  }, 1400);
}

bootCampaignCenter();

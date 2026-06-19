const executiveState = { booted: false, loading: false, lastLoad: 0, data: null, active: false };

function isAdminPage() {
  return window.location.pathname.includes('admin');
}

function token() {
  return localStorage.getItem('hotdog_token') || '';
}

function money(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0));
}

function activeAdminTab() {
  const active = document.querySelector('.sidebar-nav button.active');
  return (active?.textContent || '').trim().toLowerCase();
}

function isDashboardActive() {
  return isAdminPage() && token() && activeAdminTab().includes('dashboard');
}

async function adminGet(path) {
  const response = await fetch(path, { headers: { Authorization: `Bearer ${token()}` } });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.message || 'Erro ao carregar dashboard.');
  return data;
}

async function loadExecutiveData(force = false) {
  if (executiveState.loading) return executiveState.data;
  if (!force && executiveState.data && Date.now() - executiveState.lastLoad < 15000) return executiveState.data;
  executiveState.loading = true;
  try {
    const [orders, summary, dashboard, customers, report] = await Promise.all([
      adminGet('/api/admin/orders'),
      adminGet('/api/admin/finance/summary'),
      adminGet('/api/admin/dashboard'),
      adminGet('/api/admin/customers'),
      adminGet('/api/admin/reports/sales')
    ]);
    executiveState.data = { orders, summary, dashboard, customers, report };
    executiveState.lastLoad = Date.now();
    return executiveState.data;
  } finally {
    executiveState.loading = false;
  }
}

function statusLabel(status) {
  return {
    novo: 'Novos',
    preparo: 'Em preparo',
    saiu_entrega: 'Em entrega',
    concluido: 'Concluidos',
    cancelado: 'Cancelados'
  }[status] || status;
}

function statusClass(status) {
  return String(status || '').replace(/_/g, '-');
}

function orderTime(order) {
  if (!order?.created_at) return '';
  return new Date(order.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function productName(item) {
  return item?.name || item?.product_name || 'Produto';
}

function mainItems(order) {
  return (order.items || []).filter((item) => item.item_type === 'produto');
}

function topProducts(orders, dashboard) {
  if (dashboard?.top_products?.length) {
    return dashboard.top_products.map((item) => ({ name: item.name, qty: Number(item.quantity || 0) })).slice(0, 5);
  }
  const map = new Map();
  orders.forEach((order) => {
    mainItems(order).forEach((item) => map.set(productName(item), (map.get(productName(item)) || 0) + Number(item.quantity || 0)));
  });
  return [...map.entries()].map(([name, qty]) => ({ name, qty })).sort((a, b) => b.qty - a.qty).slice(0, 5);
}

function statusCounts(orders) {
  const statuses = ['novo', 'preparo', 'saiu_entrega', 'concluido', 'cancelado'];
  return statuses.map((status) => ({ status, label: statusLabel(status), count: orders.filter((order) => order.status === status).length }));
}

function paymentTotals(orders) {
  const labels = { dinheiro: 'Dinheiro', pix: 'PIX', cartao: 'Cartao', fiado: 'Fiado' };
  const map = new Map();
  orders.forEach((order) => {
    const key = labels[order.payment_method] || order.payment_method || 'Outros';
    map.set(key, (map.get(key) || 0) + Number(order.total || 0));
  });
  return [...map.entries()].map(([name, total]) => ({ name, total })).sort((a, b) => b.total - a.total);
}

function hourlySales(orders) {
  const hours = Array.from({ length: 8 }, (_, index) => 16 + index);
  const map = new Map(hours.map((hour) => [hour, 0]));
  orders.forEach((order) => {
    if (!order.created_at) return;
    const hour = new Date(order.created_at).getHours();
    const key = hours.includes(hour) ? hour : hours.reduce((closest, current) => Math.abs(current - hour) < Math.abs(closest - hour) ? current : closest, hours[0]);
    map.set(key, (map.get(key) || 0) + Number(order.total || 0));
  });
  return [...map.entries()].map(([hour, total]) => ({ hour: `${String(hour).padStart(2, '0')}h`, total }));
}

function completionRate(orders) {
  if (!orders.length) return 100;
  const canceled = orders.filter((order) => order.status === 'cancelado').length;
  return Math.max(0, Math.round(100 - (canceled / orders.length) * 100));
}

function isToday(order) {
  if (!order?.created_at) return false;
  const date = new Date(order.created_at);
  const now = new Date();
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate();
}

function customerStats(customers, orders) {
  const uniqueToday = new Set(orders.map((order) => order.customer_phone || order.customer_name).filter(Boolean)).size;
  return { total: customers?.length || uniqueToday, today: uniqueToday };
}

function ensureContainer() {
  const workspace = document.querySelector('.admin-workspace');
  const topbar = document.querySelector('.admin-topbar');
  if (!workspace || !topbar) return null;
  let node = document.querySelector('.executive-dashboard');
  if (!node) {
    node = document.createElement('section');
    node.className = 'executive-dashboard';
    topbar.insertAdjacentElement('afterend', node);
  }
  return node;
}

function metricCard(icon, label, value, footer, tone = '') {
  return `<article class="exec-metric ${tone}"><span>${icon}</span><div><small>${label}</small><strong>${value}</strong>${footer ? `<em>${footer}</em>` : ''}</div></article>`;
}

function renderBarChart(title, subtitle, rows, valueKey, formatter = (v) => v) {
  const max = Math.max(1, ...rows.map((row) => Number(row[valueKey] || 0)));
  return `<section class="exec-panel exec-chart"><div class="exec-panel-head"><div><h3>${title}</h3><p>${subtitle}</p></div></div><div class="exec-bars">${rows.map((row) => `<div class="exec-bar-row"><span>${row.name || row.hour || row.label}</span><i><b style="width:${Math.max(4, (Number(row[valueKey] || 0) / max) * 100)}%"></b></i><strong>${formatter(row[valueKey])}</strong></div>`).join('')}</div></section>`;
}

function renderStatusDonut(rows) {
  const total = rows.reduce((sum, row) => sum + row.count, 0) || 1;
  const completed = rows.find((row) => row.status === 'concluido')?.count || 0;
  const progress = Math.round((completed / total) * 100);
  return `<section class="exec-panel exec-status"><div class="exec-panel-head"><div><h3>Status dos pedidos</h3><p>Resumo operacional de hoje</p></div><strong>${total}</strong></div><div class="exec-status-grid"><div class="exec-donut" style="--p:${progress}"><span>${progress}%</span><small>conclusao</small></div><div class="exec-status-list">${rows.map((row) => `<div><i class="${statusClass(row.status)}"></i><span>${row.label}</span><b>${row.count}</b></div>`).join('')}</div></div></section>`;
}

function renderLatestOrders(orders) {
  const latest = orders.slice(0, 6);
  return `<section class="exec-panel exec-latest"><div class="exec-panel-head"><div><h3>Ultimos pedidos</h3><p>Acompanhe sem operar o Kanban</p></div><button type="button" data-go-orders>Ver pedidos</button></div><div class="exec-order-list">${latest.map((order) => `<article><div><strong>${order.public_code || `#${order.id}`}</strong><small>${orderTime(order)} • ${statusLabel(order.status)}</small></div><span>${order.customer_name || '-'}</span><b>${money(order.total)}</b></article>`).join('') || '<p class="muted">Nenhum pedido ainda.</p>'}</div></section>`;
}

function renderAlerts(orders, summary) {
  const pending = Number(summary?.pending_today || 0);
  const canceled = orders.filter((order) => order.status === 'cancelado').length;
  const prep = orders.filter((order) => order.status === 'preparo').length;
  const alerts = [
    pending > 0 ? ['💸', 'Valor pendente', `${money(pending)} ainda nao recebido`] : ['✅', 'Recebimentos em dia', 'Nenhum alerta financeiro critico'],
    prep > 2 ? ['🔥', 'Cozinha movimentada', `${prep} pedidos em preparo`] : ['🍳', 'Operacao controlada', 'Fila de preparo sob controle'],
    canceled > 3 ? ['⚠️', 'Cancelamentos altos', `${canceled} pedidos cancelados`] : ['⭐', 'Boa experiencia', 'Cancelamentos dentro do aceitavel']
  ];
  return `<section class="exec-panel exec-alerts"><div class="exec-panel-head"><div><h3>Alertas inteligentes</h3><p>Pontos de atencao para o gestor</p></div></div>${alerts.map(([icon, title, text]) => `<div class="exec-alert"><span>${icon}</span><div><strong>${title}</strong><small>${text}</small></div></div>`).join('')}</section>`;
}

function renderExecutiveDashboard(data) {
  const node = ensureContainer();
  if (!node) return;
  const { orders = [], summary = {}, dashboard = {}, customers = [] } = data || {};
  const today = orders.filter(isToday);
  const todayOrders = Number(summary?.orders_today || orders.length || 0);
  const ticket = todayOrders ? Number(summary?.gross_today || 0) / todayOrders : 0;
  const paid = Number(summary?.paid_today || 0);
  const pending = Number(summary?.pending_today || 0);
  const gross = Number(summary?.gross_today || 0);
  const net = Number(summary?.net_today || gross - pending);
  const clients = customerStats(customers, today);
  const products = topProducts(today, null);
  const statuses = statusCounts(today);
  const payments = paymentTotals(today);
  const salesHours = hourlySales(today);
  const rate = completionRate(today);

  node.innerHTML = `
    <div class="exec-hero">
      <div>
        <span>Painel geral</span>
        <h2>Visao completa do delivery</h2>
        <p>Financeiro, pedidos, clientes e produtos em uma tela para decisao rapida.</p>
      </div>
      <div class="exec-health"><strong>${rate}%</strong><small>saude operacional</small></div>
    </div>
    <section class="exec-metrics">
      ${metricCard('💰', 'Faturamento bruto', money(gross), 'Hoje', 'gold')}
      ${metricCard('✅', 'Recebido', money(paid), 'Entradas confirmadas', 'green')}
      ${metricCard('⏳', 'Pendente', money(pending), 'A receber', 'orange')}
      ${metricCard('📈', 'Liquido estimado', money(net), 'Apos despesas', 'blue')}
      ${metricCard('🧾', 'Pedidos', todayOrders, 'Volume do dia', 'red')}
      ${metricCard('🎯', 'Ticket medio', money(ticket), 'Valor por pedido', 'purple')}
      ${metricCard('👥', 'Clientes hoje', clients.today, `${clients.total} cadastrados`, 'cyan')}
      ${metricCard('🏆', 'Mais vendido', products[0]?.name || '-', products[0] ? `${products[0].qty}x` : '0x', 'Produto destaque')}
    </section>
    <section class="exec-grid-main">
      ${renderBarChart('Vendas por horario', 'Movimento aproximado do dia', salesHours, 'total', money)}
      ${renderStatusDonut(statuses)}
      ${renderBarChart('Formas de pagamento', 'Participacao por valor', payments.length ? payments : [{ name: 'Sem vendas', total: 0 }], 'total', money)}
      ${renderBarChart('Produtos mais vendidos', 'Ranking de itens', products.length ? products : [{ name: 'Sem vendas', qty: 0 }], 'qty', (v) => `${v || 0}x`)}
      ${renderLatestOrders(orders)}
      ${renderAlerts(today, summary)}
    </section>
  `;

  node.querySelector('[data-go-orders]')?.addEventListener('click', () => {
    [...document.querySelectorAll('.sidebar-nav button')].find((button) => button.textContent.toLowerCase().includes('pedidos'))?.click();
  });
}

async function activateExecutiveDashboard() {
  if (!isDashboardActive()) {
    document.body.classList.remove('admin-executive-mode');
    document.querySelector('.executive-dashboard')?.remove();
    executiveState.active = false;
    return;
  }
  document.body.classList.add('admin-executive-mode');
  executiveState.active = true;
  const node = ensureContainer();
  if (node && !executiveState.data) node.innerHTML = '<div class="exec-loading">Carregando visao geral...</div>';
  try {
    const data = await loadExecutiveData(false);
    renderExecutiveDashboard(data);
  } catch (error) {
    if (node) node.innerHTML = `<div class="exec-loading error">${error.message}</div>`;
  }
}

function bootExecutiveDashboard() {
  if (executiveState.booted) return;
  executiveState.booted = true;
  setInterval(activateExecutiveDashboard, 1200);
  setInterval(() => {
    if (executiveState.active) loadExecutiveData(true).then(renderExecutiveDashboard).catch(() => null);
  }, 16000);
  setTimeout(activateExecutiveDashboard, 600);
}

bootExecutiveDashboard();

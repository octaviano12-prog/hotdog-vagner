const reportState = {
  booted: false,
  lastData: null
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

function today() {
  return new Date().toISOString().slice(0, 10);
}

function csvValue(value) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

async function adminGet(path) {
  const response = await fetch(path, { headers: { Authorization: `Bearer ${token()}` } });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.message || 'Erro ao carregar relatorio.');
  return data;
}

async function loadReportData() {
  if (!token()) throw new Error('Acesse o painel para gerar relatorios.');
  const [orders, summary, cash, sales] = await Promise.all([
    adminGet('/api/admin/orders'),
    adminGet('/api/admin/finance/summary'),
    adminGet('/api/admin/finance/cash/current'),
    adminGet(`/api/admin/reports/sales?from=${today()}&to=${today()}`)
  ]);
  const data = { orders, summary, cash, sales, generated_at: new Date().toISOString() };
  reportState.lastData = data;
  return data;
}

function itemNames(order) {
  return (order.items || [])
    .filter((item) => item.item_type === 'produto')
    .map((item) => `${item.quantity}x ${item.name}`)
    .join(' | ');
}

function exportOrdersCsv(data) {
  const rows = [
    ['Codigo', 'Data', 'Cliente', 'Telefone', 'Status', 'Pagamento', 'Forma', 'Entrega', 'Itens', 'Subtotal', 'Taxa', 'Total'],
    ...data.orders.map((order) => [
      order.public_code || `#${order.id}`,
      order.created_at ? new Date(order.created_at).toLocaleString('pt-BR') : '',
      order.customer_name,
      order.customer_phone,
      order.status,
      order.payment_status,
      order.payment_method,
      order.delivery_type,
      itemNames(order),
      order.subtotal,
      order.delivery_fee,
      order.total
    ])
  ];

  const csv = rows.map((row) => row.map(csvValue).join(';')).join('\n');
  const blob = new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `pedidos-hotdog-vagner-${today()}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function paymentTotals(orders) {
  return orders.reduce((acc, order) => {
    if (order.status === 'cancelado') return acc;
    const key = order.payment_method || 'outros';
    acc[key] = (acc[key] || 0) + Number(order.total || 0);
    return acc;
  }, {});
}

function buildSummaryText(data) {
  const totals = paymentTotals(data.orders);
  const pending = data.orders.filter((order) => order.payment_status === 'pendente' && order.status !== 'cancelado');
  const lines = [
    `Resumo do dia - Hot Dog do Vagner (${new Date().toLocaleDateString('pt-BR')})`,
    '',
    `Pedidos: ${data.summary?.orders_today || data.orders.length}`,
    `Faturamento: ${money(data.summary?.gross_today || data.sales?.summary?.gross)}`,
    `Recebido: ${money(data.summary?.paid_today || data.sales?.summary?.paid)}`,
    `Pendente: ${money(data.summary?.pending_today || data.sales?.summary?.pending)}`,
    `Despesas: ${money(data.summary?.expenses_today || data.sales?.summary?.expenses)}`,
    `Liquido: ${money(data.summary?.net_today || data.sales?.summary?.net)}`,
    '',
    'Por forma de pagamento:',
    ...Object.entries(totals).map(([method, total]) => `- ${method}: ${money(total)}`),
    '',
    `Pedidos pendentes: ${pending.length}`
  ];
  return lines.join('\n');
}

async function copySummary(data) {
  const text = buildSummaryText(data);
  await navigator.clipboard.writeText(text);
  showToast('Resumo copiado para enviar no WhatsApp.');
}

function printDailyReport(data) {
  const totals = paymentTotals(data.orders);
  const pending = data.orders.filter((order) => order.payment_status === 'pendente' && order.status !== 'cancelado');
  const html = `
    <html>
      <head>
        <title>Relatorio diario - Hot Dog do Vagner</title>
        <style>
          body{font-family:Arial,sans-serif;margin:28px;color:#161616}.head{display:flex;justify-content:space-between;gap:18px;border-bottom:3px solid #111;padding-bottom:14px;margin-bottom:18px}.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:18px 0}.card{border:1px solid #222;border-radius:12px;padding:12px}.card b{display:block;font-size:20px;margin-top:6px}table{width:100%;border-collapse:collapse;margin-top:14px}th,td{border-bottom:1px solid #ddd;padding:8px;text-align:left;font-size:12px}.total{font-size:24px;font-weight:900}.warn{color:#a34b00;font-weight:800}@media print{button{display:none}.card{break-inside:avoid}}
        </style>
      </head>
      <body>
        <button onclick="window.print()">Imprimir relatorio</button>
        <section class="head"><div><h1>Hot Dog do Vagner</h1><p>Relatorio diario gerado em ${new Date().toLocaleString('pt-BR')}</p></div><div class="total">${money(data.summary?.net_today || data.sales?.summary?.net)}<br><small>liquido</small></div></section>
        <section class="grid">
          <div class="card">Pedidos<b>${data.summary?.orders_today || data.orders.length}</b></div>
          <div class="card">Faturamento<b>${money(data.summary?.gross_today || data.sales?.summary?.gross)}</b></div>
          <div class="card">Recebido<b>${money(data.summary?.paid_today || data.sales?.summary?.paid)}</b></div>
          <div class="card">Pendente<b>${money(data.summary?.pending_today || data.sales?.summary?.pending)}</b></div>
          <div class="card">Despesas<b>${money(data.summary?.expenses_today || data.sales?.summary?.expenses)}</b></div>
          <div class="card">Caixa<b>${data.cash?.register ? 'Aberto' : 'Fechado'}</b></div>
          ${Object.entries(totals).map(([method, total]) => `<div class="card">${method}<b>${money(total)}</b></div>`).join('')}
        </section>
        ${pending.length ? `<p class="warn">Atenção: ${pending.length} pedido(s) com pagamento pendente.</p>` : '<p>Sem pagamentos pendentes no momento.</p>'}
        <h2>Pedidos do dia</h2>
        <table><thead><tr><th>Codigo</th><th>Cliente</th><th>Status</th><th>Pagamento</th><th>Itens</th><th>Total</th></tr></thead><tbody>
          ${data.orders.map((order) => `<tr><td>${order.public_code || `#${order.id}`}</td><td>${order.customer_name || ''}</td><td>${order.status}</td><td>${order.payment_status} / ${order.payment_method}</td><td>${itemNames(order)}</td><td>${money(order.total)}</td></tr>`).join('')}
        </tbody></table>
        <script>setTimeout(()=>window.print(),300)</script>
      </body>
    </html>`;
  const win = window.open('', '_blank', 'width=960,height=900');
  if (!win) return;
  win.document.write(html);
  win.document.close();
}

function showToast(message) {
  let toast = document.querySelector('.report-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'report-toast';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2600);
}

async function withData(action) {
  try {
    const data = await loadReportData();
    action(data);
  } catch (error) {
    showToast(error.message);
  }
}

function ensureReportDock() {
  if (!isAdminPage() || !token() || document.querySelector('.report-dock')) return;
  const dock = document.createElement('section');
  dock.className = 'report-dock';
  dock.innerHTML = `
    <strong>Relatorios</strong>
    <button type="button" data-report-print>Imprimir resumo</button>
    <button type="button" data-report-csv>Exportar CSV</button>
    <button type="button" data-report-copy>Copiar WhatsApp</button>
  `;
  document.body.appendChild(dock);
  dock.querySelector('[data-report-print]').addEventListener('click', () => withData(printDailyReport));
  dock.querySelector('[data-report-csv]').addEventListener('click', () => withData(exportOrdersCsv));
  dock.querySelector('[data-report-copy]').addEventListener('click', () => withData(copySummary));
}

function bootReports() {
  if (reportState.booted) return;
  reportState.booted = true;
  setInterval(ensureReportDock, 1500);
  setTimeout(ensureReportDock, 800);
}

bootReports();

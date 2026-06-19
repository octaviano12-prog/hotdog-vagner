const menuRank = { booted: false, rows: [], extras: [], orders: 0, gross: 0 };

function isAdmin() { return window.location.pathname.includes('admin'); }
function adminToken() { return localStorage.getItem('hotdog_token') || ''; }
function brl(v) { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v || 0)); }
function itemName(v) { return String(v || 'Item'); }

async function getAdmin(path) {
  const response = await fetch(path, { headers: { Authorization: `Bearer ${adminToken()}` } });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.message || 'Nao foi possivel carregar o ranking.');
  return data;
}

function addTo(map, item, order) {
  const key = itemName(item.name);
  const current = map.get(key) || { name: key, quantity: 0, total: 0, orders: new Set() };
  current.quantity += Number(item.quantity || 0);
  current.total += Number(item.total_price || 0);
  current.orders.add(order.id);
  map.set(key, current);
}

async function loadMenuRank() {
  const orders = await getAdmin('/api/admin/orders');
  const productMap = new Map();
  const extraMap = new Map();
  const valid = orders.filter((order) => order.status !== 'cancelado');
  valid.forEach((order) => {
    (order.items || []).forEach((item) => {
      if (item.item_type === 'produto') addTo(productMap, item, order);
      if (item.item_type === 'adicional') addTo(extraMap, item, order);
    });
  });
  menuRank.orders = valid.length;
  menuRank.gross = valid.reduce((sum, order) => sum + Number(order.total || 0), 0);
  menuRank.rows = [...productMap.values()].map((item) => ({ ...item, orderCount: item.orders.size })).sort((a, b) => b.total - a.total);
  menuRank.extras = [...extraMap.values()].map((item) => ({ ...item, orderCount: item.orders.size })).sort((a, b) => b.total - a.total);
}

function closeMenuRank() { document.querySelector('.menu-rank-overlay')?.remove(); }

function rankTable(rows, empty) {
  return rows.length ? rows.map((row, index) => `<article><span>${index + 1}</span><div><strong>${row.name}</strong><small>${row.quantity} unidade(s) em ${row.orderCount} pedido(s)</small></div><b>${brl(row.total)}</b></article>`).join('') : `<div class="menu-rank-empty">${empty}</div>`;
}

function exportMenuRank() {
  const rows = [['Tipo', 'Nome', 'Quantidade', 'Pedidos', 'Faturamento'], ...menuRank.rows.map((r) => ['Produto', r.name, r.quantity, r.orderCount, r.total]), ...menuRank.extras.map((r) => ['Adicional', r.name, r.quantity, r.orderCount, r.total])];
  const csv = rows.map((row) => row.map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`).join(';')).join('\n');
  const blob = new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ranking-cardapio-hotdog-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

async function copyMenuRank() {
  const lines = ['Ranking do cardapio - Hotdog Prensado', '', `Pedidos validos: ${menuRank.orders}`, `Faturamento: ${brl(menuRank.gross)}`, '', 'Top produtos:', ...menuRank.rows.slice(0, 8).map((r, i) => `${i + 1}. ${r.name} - ${r.quantity} un. - ${brl(r.total)}`)];
  await navigator.clipboard.writeText(lines.join('\n'));
  renderMenuRank('Resumo copiado.');
}

function renderMenuRank(message = '') {
  let overlay = document.querySelector('.menu-rank-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.className = 'menu-rank-overlay';
    overlay.addEventListener('click', (event) => { if (event.target === overlay) closeMenuRank(); });
    document.body.appendChild(overlay);
  }
  const best = menuRank.rows[0];
  const bestExtra = menuRank.extras[0];
  overlay.innerHTML = `<section class="menu-rank-panel"><button class="menu-rank-close" type="button">×</button><header><span>Cardapio inteligente</span><h2>Ranking de vendas</h2><p>Veja o que mais vende, quais adicionais geram dinheiro e o que destacar no cardapio.</p></header><div class="menu-rank-actions"><button data-refresh type="button">Atualizar</button><button data-copy type="button">Copiar resumo</button><button data-export type="button">Exportar CSV</button></div><div class="menu-rank-metrics"><article><span>Pedidos</span><strong>${menuRank.orders}</strong></article><article><span>Faturamento</span><strong>${brl(menuRank.gross)}</strong></article><article><span>Campeao</span><strong>${best?.name || '-'}</strong></article><article><span>Melhor adicional</span><strong>${bestExtra?.name || '-'}</strong></article></div><div class="menu-rank-tip">${best ? `Sugestao: coloque ${best.name} em destaque no topo do cardapio e ofereca ${bestExtra?.name || 'um adicional'} no checkout.` : 'Quando houver pedidos, as sugestoes aparecem aqui.'}</div><p class="menu-rank-message">${message}</p><h3>Produtos</h3><div class="menu-rank-list">${rankTable(menuRank.rows, 'Nenhum produto vendido ainda.')}</div><h3>Adicionais</h3><div class="menu-rank-list">${rankTable(menuRank.extras, 'Nenhum adicional vendido ainda.')}</div></section>`;
  overlay.querySelector('.menu-rank-close').addEventListener('click', closeMenuRank);
  overlay.querySelector('[data-refresh]').addEventListener('click', async () => { renderMenuRank('Atualizando...'); await loadMenuRank(); renderMenuRank(); });
  overlay.querySelector('[data-copy]').addEventListener('click', copyMenuRank);
  overlay.querySelector('[data-export]').addEventListener('click', exportMenuRank);
}

function ensureMenuRankDock() {
  if (!isAdmin() || !adminToken() || document.querySelector('.menu-rank-dock')) return;
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'menu-rank-dock';
  button.innerHTML = '<span>📊</span><strong>Cardápio</strong>';
  button.addEventListener('click', async () => { renderMenuRank('Carregando ranking...'); try { await loadMenuRank(); renderMenuRank(); } catch (error) { renderMenuRank(error.message); } });
  document.body.appendChild(button);
}

function bootMenuRank() {
  if (menuRank.booted) return;
  menuRank.booted = true;
  setInterval(ensureMenuRankDock, 1400);
}

bootMenuRank();

if (window.location.pathname.includes('admin')) {
  import('./admin-daily-goals.css');
  import('./admin-daily-goals.js');
}
